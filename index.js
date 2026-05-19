require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/check', async (req, res) => {
    const { license } = req.query;
    if (!license) return res.status(400).json({ activated: false });

    try {
        const result = await pool.query('SELECT activated FROM players WHERE license = $1', [license]);
        const activated = result.rows[0]?.activated || false;
        res.json({ activated });
    } catch (e) {
        res.status(500).json({ activated: false });
    }
});

// Aktivieren per Code (POST)
app.post('/activate', async (req, res) => {
    const { code, license } = req.body;

    // Hier Code-Logik (z.B. einmalig gültiger Code)
    if (code === "DEIN_SECRET_CODE" || await checkValidCode(code)) {
        await pool.query('INSERT INTO players (license, activated) VALUES ($1, true) ON CONFLICT (license) DO UPDATE SET activated = true', [license]);
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('API läuft'));