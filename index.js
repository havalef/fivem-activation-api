require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Zufälligen Code generieren
function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Check beim Join
app.get('/check', async (req, res) => {
    const { license } = req.query;
    if (!license) return res.json({ activated: false });

    try {
        const result = await pool.query(
            'SELECT activated, pending_code FROM players WHERE license = $1', 
            [license]
        );

        const player = result.rows[0];

        if (player && player.activated) {
            return res.json({ activated: true });
        }

        // Neuen Code generieren falls keiner existiert oder abgelaufen
        const code = generateCode();
        await pool.query(`
            INSERT INTO players (license, pending_code, code_expires)
            VALUES ($1, $2, NOW() + INTERVAL '30 minutes')
            ON CONFLICT (license) 
            DO UPDATE SET pending_code = $2, code_expires = NOW() + INTERVAL '30 minutes'
        `, [license, code]);

        res.json({ 
            activated: false, 
            code: code,
            message: "Code generiert"
        });
    } catch (err) {
        console.error(err);
        res.json({ activated: false });
    }
});

// Aktivieren mit Code
app.post('/activate', async (req, res) => {
    const { code, license } = req.body;

    if (!code || !license) {
        return res.status(400).json({ success: false, message: "Code und License erforderlich" });
    }

    try {
        const result = await pool.query(
            'SELECT pending_code FROM players WHERE license = $1 AND code_expires > NOW()', 
            [license]
        );

        if (result.rows[0] && result.rows[0].pending_code === code.toUpperCase()) {
            await pool.query(
                'UPDATE players SET activated = true, pending_code = NULL WHERE license = $1',
                [license]
            );
            res.json({ success: true, message: "Erfolgreich aktiviert!" });
        } else {
            res.status(400).json({ success: false, message: "Falscher oder abgelaufener Code" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Server Fehler" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Activation API läuft auf Port ${PORT}`));
