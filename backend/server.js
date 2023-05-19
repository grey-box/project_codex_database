const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const speech = require('@google-cloud/speech');
require('dotenv').config();


const app = express();
const port = process.env.PORT || 4000;

const GOOGLE_APPLICATION_CREDENTIALS = 'key.json';
process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_APPLICATION_CREDENTIALS;

app.use(cors());
app.use(express.json());

const uri = process.env.ATLAS_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const textToSpeech = require('@google-cloud/text-to-speech');
const ttsClient = new textToSpeech.TextToSpeechClient();

async function textToSpeechHelper(text) {
    const request = {
      input: { text },
      // Select the language and SSML Voice Gender (optional)
      voice: { languageCode: 'uk-UA', ssmlGender: 'NEUTRAL' },
      // Select the type of audio encoding
      audioConfig: { audioEncoding: 'MP3' },
    };
  
    try {
      const [response] = await ttsClient.synthesizeSpeech(request);
      return response.audioContent;
    } catch (error) {
      console.error('Error in textToSpeech function:', error);
      return null;
    }
}

async function transcribe(audioBuffer) {
    const client = new speech.SpeechClient();
    const audio = {
      content: audioBuffer.toString('base64'),
    };
    const config = {
      encoding: 'LINEAR16',
      sampleRateHertz: 24000,
      languageCode: 'en-US',
    };
    const request = {
      audio: audio,
      config: config,
    };
  
    const [response] = await client.recognize(request);
    const transcription = response.results
      .map((result) => result.alternatives[0].transcript)
      .join('\n');
    console.log(`Transcription: ${transcription}`);
    return transcription;
}

async function connectToDatabase() {
    try {
        await client.connect();
        console.log("MongoDB database connection established successfully");
    } catch (err) {
        console.error(err)
    }
}

connectToDatabase();

async function getTranslatedName(medicineName) {
    try {
        const db = client.db('test');
        const collection = db.collection('WHO_Database');

        const query = { Medicine: medicineName };
        const medicine = await collection.findOne(query);

        if (medicine) {
            const translation = medicine.Automatic_Translation || medicine.Manual_Translation;
            console.log('Translated Name:', translation);
            return { Translation: translation, Source: medicine.Source };;
        } else {
            console.log('Medicine not found');
            return null;
        }
    } catch (err) {
        console.error(err);
    }
}

app.get('/api/translated-names/:medicine', async (req, res) => {
    console.log("Request received for:", req.params.medicine);
    const medicineName = req.params.medicine;
    const translatedNameObject = await getTranslatedName(medicineName);
    if (translatedNameObject) {
      console.log(translatedNameObject);
      const { Translation, Source } = translatedNameObject;
      res.json({ Translation, Source });
    } else {
        res.status(404).json({ error: 'Medicine not found' });
    }
});

app.post('/api/text-to-speech', async (req, res) => {
    const { text } = req.body;
    const audioContent = await textToSpeechHelper(text); // Use your textToSpeech function here
    if (audioContent) {
        res.send(audioContent);
      } else {
        res.status(500).json({ error: 'Text-to-speech conversion failed' });
      }
});

app.post('/api/transcribe', async (req, res) => {
    try {
      const audioBuffer = Buffer.from(req.body.audio, 'base64');
      const transcription = await transcribe(audioBuffer);
      res.json({ transcription });
    } catch (error) {
      console.error('Error in transcription:', error);
      res.status(500).json({ error: 'Transcription failed' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});
