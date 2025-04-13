// src/index.js - Main entry point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// ============ AUTH ROUTES ============

// Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if user already exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      user: newUser.rows[0]
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Check if user exists
    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.rows[0].id, username: user.rows[0].username },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.rows[0].id,
        username: user.rows[0].username,
        email: user.rows[0].email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ ACCOUNT ROUTES ============

// Get all accounts for a user
app.get('/api/accounts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const accounts = await pool.query(
      `SELECT a.*, 
       ARRAY_AGG(f.flair_name) AS flairs
       FROM lol_accounts a
       LEFT JOIN account_flairs af ON a.id = af.account_id
       LEFT JOIN flairs f ON af.flair_id = f.id
       WHERE a.user_id = $1
       GROUP BY a.id`,
      [userId]
    );
    
    res.json(accounts.rows);
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a new account
app.post('/api/accounts', authenticateToken, async (req, res) => {
  try {
    const { username, password, summoner_name, server } = req.body;
    const userId = req.user.userId;
    
    // Validate input
    if (!username || !password || !summoner_name || !server) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Encrypt the account password (different from user password)
    const encryptedPassword = await bcrypt.hash(password, 10);
    
    // Create new account
    const newAccount = await pool.query(
      `INSERT INTO lol_accounts (user_id, login_username, login_password, summoner_name, server) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, login_username, summoner_name, server`,
      [userId, username, encryptedPassword, summoner_name, server]
    );
    
    res.status(201).json({
      message: 'Account added successfully',
      account: newAccount.rows[0]
    });
  } catch (error) {
    console.error('Add account error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete an account
app.delete('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const accountId = req.params.id;
    const userId = req.user.userId;
    
    // Check if account belongs to user
    const account = await pool.query(
      'SELECT * FROM lol_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );
    
    if (account.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found or not authorized' });
    }
    
    // Delete account
    await pool.query('DELETE FROM lol_accounts WHERE id = $1', [accountId]);
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ FLAIRS ROUTES ============

// Get all available flairs
app.get('/api/flairs', authenticateToken, async (req, res) => {
  try {
    const flairs = await pool.query('SELECT * FROM flairs');
    res.json(flairs.rows);
  } catch (error) {
    console.error('Get flairs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add flair to account
app.post('/api/accounts/:id/flairs', authenticateToken, async (req, res) => {
  try {
    const accountId = req.params.id;
    const { flairId } = req.body;
    const userId = req.user.userId;
    
    // Check if account belongs to user
    const account = await pool.query(
      'SELECT * FROM lol_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );
    
    if (account.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found or not authorized' });
    }
    
    // Check if flair already added
    const existingFlair = await pool.query(
      'SELECT * FROM account_flairs WHERE account_id = $1 AND flair_id = $2',
      [accountId, flairId]
    );
    
    if (existingFlair.rows.length > 0) {
      return res.status(409).json({ error: 'Flair already added to this account' });
    }
    
    // Add flair to account
    await pool.query(
      'INSERT INTO account_flairs (account_id, flair_id) VALUES ($1, $2)',
      [accountId, flairId]
    );
    
    res.status(201).json({ message: 'Flair added successfully' });
  } catch (error) {
    console.error('Add flair error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove flair from account
app.delete('/api/accounts/:accountId/flairs/:flairId', authenticateToken, async (req, res) => {
  try {
    const { accountId, flairId } = req.params;
    const userId = req.user.userId;
    
    // Check if account belongs to user
    const account = await pool.query(
      'SELECT * FROM lol_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );
    
    if (account.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found or not authorized' });
    }
    
    // Remove flair from account
    await pool.query(
      'DELETE FROM account_flairs WHERE account_id = $1 AND flair_id = $2',
      [accountId, flairId]
    );
    
    res.json({ message: 'Flair removed successfully' });
  } catch (error) {
    console.error('Remove flair error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ RIOT API ROUTES ============

// Fetch summoner data from Riot API
app.get('/api/riot/summoner/:server/:summonerName', authenticateToken, async (req, res) => {
  try {
    const { server, summonerName } = req.params;
    
    // Validate server
    const validServers = ['na1', 'euw1', 'eun1', 'kr', 'br1', 'jp1', 'ru', 'oc1', 'tr1', 'la1', 'la2'];
    if (!validServers.includes(server.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid server' });
    }
    
    // Get summoner by name from Riot API
    const summonerResponse = await axios.get(
      `https://${server}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`,
      {
        headers: {
          'X-Riot-Token': process.env.RIOT_API_KEY
        }
      }
    );
    
    const summoner = summonerResponse.data;
    
    // Get ranked data for the summoner
    const rankedResponse = await axios.get(
      `https://${server}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summoner.id}`,
      {
        headers: {
          'X-Riot-Token': process.env.RIOT_API_KEY
        }
      }
    );
    
    // Return combined data
    res.json({
      summoner,
      ranked: rankedResponse.data
    });
  } catch (error) {
    console.error('Riot API error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Summoner not found' });
    }
    
    if (error.response?.status === 403) {
      return res.status(403).json({ error: 'Invalid Riot API key' });
    }
    
    res.status(500).json({ error: 'Error fetching data from Riot API' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});