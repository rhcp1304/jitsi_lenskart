const express = require('express');
const multer = require('multer');
const libre = require('libreoffice-convert');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { promisify } = require('util');

// Promisify the convert function for easier use with async/await
const libreConvert = promisify(libre.convert);

const app = express();
const port = 3001; // The port for your server to run on

// Enable CORS for all routes, allowing your client to connect
app.use(cors());

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save uploaded files to a 'uploads' directory
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Use the original filename
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

// Create the uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Conversion endpoint
app.post('/convert-ppt', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = path.join(__dirname, 'uploads', req.file.filename);
  const outputPath = path.join(__dirname, 'uploads', `${path.parse(req.file.filename).name}.pdf`);
  const fileExtension = path.extname(req.file.filename);

  // Check if the file is a PowerPoint file
  if (!['.ppt', '.pptx'].includes(fileExtension.toLowerCase())) {
    fs.unlinkSync(inputPath); // Clean up the uploaded file
    return res.status(400).json({ error: 'Unsupported file type. Please upload a .ppt or .pptx file.' });
  }

  try {
    // Read the uploaded file
    const file = fs.readFileSync(inputPath);

    // Convert the file to PDF
    const pdf = await libreConvert(file, '.pdf', undefined);

    // Write the PDF to a temporary file
    fs.writeFileSync(outputPath, pdf);

    // Send the converted PDF back to the client
    res.download(outputPath, `${path.parse(req.file.filename).name}.pdf`, (err) => {
      // Cleanup the temporary files after sending
      if (!err) {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      }
    });

  } catch (error) {
    console.error('Conversion failed:', error);
    res.status(500).json({ error: 'File conversion failed.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});