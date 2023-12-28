import express from 'express';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { GaxiosError } from 'gaxios';
import { GoogleAuth } from 'google-auth-library';

require('dotenv').config();


// Your path to the service account file
const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH
if (!CREDENTIALS_PATH) {
  throw new Error('CREDENTIALS_PATH is not defined. Please check your .env file or environment variables.')
}
const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8'))


// Read the contents of the service account file


// Initialize the JWT auth client
const jwtClient = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// Instance of Express
const app = express();
const PORT = 3000;

async function readGoogleSheets(spreadsheetId: string, range: string): Promise<string[]> {
  const sheets = google.sheets({ version: 'v4', auth: jwtClient });

  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values;
    const output: string[] = [];

    if (rows) {
      rows.forEach((row) => {
        const status = row[5];
        if (status === 'Accepted') {
          const timestamp = row[1];
          let fromUser = row[0].split('/')[1].trim(); // Mengambil hanya nama pengguna setelah slash
          let description = row[4];
          // Menghapus semua karakter sebelum dan termasuk ":"
          let issue = description.replace(/^[^:]*:\s*/, "").replace(/\n/g, " ").trim();
          // Memotong teks issue menjadi 32 karakter
          if (issue.length > 32) {
            issue = issue.substring(0, 32);
          }
          const unixTime = Math.floor(new Date(timestamp).getTime() / 1000);

          // Template string dengan data yang sudah diformat
          const feedbackString = `new_feedback{app="nusawork",since="${timestamp}",from="${fromUser}",issue="${issue}"} ${unixTime}`;
          output.push(feedbackString.replace(/\s+/g, ' ')); // Memastikan tidak ada spasi ganda
        }
      });
    }
    return output;
  } catch (err) {
    const error = err as GaxiosError;
    console.error('The API returned an error: ', error.message);
    return [`Error retrieving data: ${error.message}`];
  }
}

app.get('/fetch-data', async (req, res) => {
  const spreadsheetId = process.env.NUSAWORK_DOC_ID!
  const range = 'List Feedback!A2:F4';
  const feedbackData = await readGoogleSheets(spreadsheetId, range);
  res.type('text').send(feedbackData.join('\n'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
