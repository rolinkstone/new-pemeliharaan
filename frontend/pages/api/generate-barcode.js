// pages/api/generate-barcode.js
import bwipjs from 'bwip-js';

export default function handler(req, res) {
    const { barcode } = req.query;

    if (!barcode) {
        return res.status(400).json({ error: 'Barcode value is required' });
    }

    res.setHeader('Content-Type', 'image/png');
    bwipjs.toBuffer({
        bcid: 'code128',       // Barcode type
        text: barcode,         // Text to encode
        scale: 3,              // Scale factor
        height: 10,            // Height of the barcode
        width: 200,            // Width of the barcode
        includetext: true,     // Include text below the barcode
        textxalign: 'center',  // Center the text
    }, (err, png) => {
        if (err) {
            res.status(500).json({ error: 'Error generating barcode' });
        } else {
            res.end(png);
        }
    });
}
