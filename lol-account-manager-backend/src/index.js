// src/index.js - Main entry point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');

// Import the default flairs
const defaultFlairs = require('./data/flairsData');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Encryption key for passwords (for two-way encryption)
// In production, this should be securely stored in environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secure-encryption-key-32-chars-min'; 
const IV_LENGTH = 16; // For AES, this is always 16

// Two-way encryption and decryption functions for passwords
function encrypt(text) {
  try {
    // Make sure the key is exactly 32 bytes for AES-256-CBC
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption error:', error);
    // Fallback to storing plaintext with a marker (only for development)
    return 'PLAINTEXT:' + text;
  }
}

function decrypt(text) {
  try {
    // Check if this is a plaintext fallback
    if (text.startsWith('PLAINTEXT:')) {
      return text.substring(10); // Skip the 'PLAINTEXT:' prefix
    }
    
    const parts = text.split(':');
    if (parts.length !== 2) return null;
    
    // Make sure the key is exactly 32 bytes for AES-256-CBC
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// Database connection
let pool;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  console.log('Database connection established');
} catch (error) {
  console.error('Error connecting to database:', error.message);
  console.log('Running in development mode with in-memory storage');
}

// In-memory storage for development
const inMemoryUsers = [];
const inMemoryAccounts = [];
const inMemoryAccountFlairs = [];
let nextUserId = 1;
let nextAccountId = 1;

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
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
    
    let userExists = false;
    
    try {
      // Check if user already exists in database
      const userExistsResult = await pool.query(
        'SELECT * FROM users WHERE email = $1 OR username = $2',
        [email, username]
      );
      
      userExists = userExistsResult.rows.length > 0;
    } catch (dbError) {
      console.log('Using in-memory check due to database error:', dbError.message);
      // If database query fails, check in-memory storage
      userExists = inMemoryUsers.some(u => u.email === email || u.username === username);
    }
    
    if (userExists) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    let newUser;
    
    try {
      // Create new user in database
      const newUserResult = await pool.query(
        'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
        [username, email, hashedPassword]
      );
      
      newUser = newUserResult.rows[0];
    } catch (dbError) {
      console.log('Using in-memory storage due to database error:', dbError.message);
      // If database query fails, add to in-memory storage
      const id = nextUserId++;
      inMemoryUsers.push({
        id,
        username,
        email,
        password: hashedPassword
      });
      
      newUser = { id, username, email };
    }
    
    res.status(201).json({
      message: 'User registered successfully',
      user: newUser
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
    
    let user;
    
    try {
      // Check if user exists in database
      const userResult = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      user = userResult.rows[0];
    } catch (dbError) {
      console.log('Using in-memory check due to database error:', dbError.message);
      // If database query fails, check in-memory storage
      user = inMemoryUsers.find(u => u.email === email);
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
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
    
    let accounts = [];
    
    try {
      // Get accounts from database with flairs
      const accountsResult = await pool.query(
        `SELECT a.*, 
         ARRAY_AGG(f.flair_name) AS flairs
         FROM lol_accounts a
         LEFT JOIN account_flairs af ON a.id = af.account_id
         LEFT JOIN flairs f ON af.flair_id = f.id
         WHERE a.user_id = $1
         GROUP BY a.id`,
        [userId]
      );
      
      accounts = accountsResult.rows;
      
      // Try to decrypt passwords if stored with two-way encryption
      accounts = accounts.map(account => {
        if (account.login_password_encrypted) {
          const decryptedPassword = decrypt(account.login_password_encrypted);
          if (decryptedPassword) {
            return { ...account, decrypted_password: decryptedPassword };
          }
        }
        return account;
      });
      
    } catch (dbError) {
      console.log('Using in-memory storage due to database error:', dbError.message);
      // If database query fails, use in-memory storage
      accounts = inMemoryAccounts.filter(a => a.user_id === userId);
      
      // Add flairs to accounts
      accounts = accounts.map(account => {
        const accountFlairs = inMemoryAccountFlairs
          .filter(f => f.account_id === account.id)
          .map(f => {
            const flair = defaultFlairs.find(df => df.id === f.flair_id);
            return flair ? flair.flair_name : null;
          })
          .filter(f => f !== null);
        
        // Add decrypted password if available
        const decryptedPassword = account.raw_password || 
                                 (account.login_password_encrypted ? 
                                  decrypt(account.login_password_encrypted) : null);
        
        return {
          ...account,
          flairs: accountFlairs,
          ...(decryptedPassword && { decrypted_password: decryptedPassword })
        };
      });
    }
    
    res.json(accounts);
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single account by ID
app.get('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const accountId = req.params.id;
    const userId = req.user.userId;
    
    let account;
    
    try {
      // Get account from database with flairs
      const accountResult = await pool.query(
        `SELECT a.*, 
         ARRAY_AGG(f.flair_name) AS flairs
         FROM lol_accounts a
         LEFT JOIN account_flairs af ON a.id = af.account_id
         LEFT JOIN flairs f ON af.flair_id = f.id
         WHERE a.id = $1 AND a.user_id = $2
         GROUP BY a.id`,
        [accountId, userId]
      );
      
      account = accountResult.rows[0];
      
      // Try to decrypt password if stored with two-way encryption
      if (account && account.login_password_encrypted) {
        const decryptedPassword = decrypt(account.login_password_encrypted);
        if (decryptedPassword) {
          account.decrypted_password = decryptedPassword;
        }
      }
      
    } catch (dbError) {
      console.log('Using in-memory storage due to database error:', dbError.message);
      // If database query fails, use in-memory storage
      account = inMemoryAccounts.find(a => a.id === parseInt(accountId) && a.user_id === userId);
      
      if (account) {
        // Add flairs to account
        const accountFlairs = inMemoryAccountFlairs
          .filter(f => f.account_id === account.id)
          .map(f => {
            const flair = defaultFlairs.find(df => df.id === f.flair_id);
            return flair ? flair.flair_name : null;
          })
          .filter(f => f !== null);
        
        // Add decrypted password if available
        const decryptedPassword = account.raw_password || 
                                 (account.login_password_encrypted ? 
                                  decrypt(account.login_password_encrypted) : null);
        
        account = {
          ...account,
          flairs: accountFlairs,
          ...(decryptedPassword && { decrypted_password: decryptedPassword })
        };
      }
    }
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json(account);
  } catch (error) {
    console.error('Get account error:', error);
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
    
    // Encrypt the account password in two ways:
    let hashedPassword, encryptedPassword;
    
    try {
      // 1. One-way encryption for authentication (bcrypt)
      hashedPassword = await bcrypt.hash(password, 10);
      // 2. Two-way encryption for potential retrieval
      encryptedPassword = encrypt(password);
    } catch (encryptError) {
      console.error('Error encrypting password:', encryptError);
      // If encryption fails, still use bcrypt for security, but mark that we couldn't encrypt
      hashedPassword = await bcrypt.hash(password, 10);
      encryptedPassword = 'PLAINTEXT:' + password;
    }
    
    let newAccount;
    
    try {
      // Try to create new account in database with columns that might not exist
      try {
        // First try with all columns including login_password_encrypted and favorite
        const newAccountResult = await pool.query(
          `INSERT INTO lol_accounts 
           (user_id, login_username, login_password, login_password_encrypted, summoner_name, server, favorite) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           RETURNING id, login_username, summoner_name, server, favorite`,
          [userId, username, hashedPassword, encryptedPassword, summoner_name, server, false]
        );
        
        newAccount = newAccountResult.rows[0];
      } catch (fullColumnError) {
        console.log('Could not insert with all columns:', fullColumnError.message);
        
        try {
          // Try without encrypted password column
          const newAccountResult = await pool.query(
            `INSERT INTO lol_accounts 
             (user_id, login_username, login_password, summoner_name, server, favorite) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id, login_username, summoner_name, server, favorite`,
            [userId, username, hashedPassword, summoner_name, server, false]
          );
          
          newAccount = newAccountResult.rows[0];
        } catch (favoriteOnlyError) {
          console.log('Could not insert with favorite column:', favoriteOnlyError.message);
          
          // Try without both columns
          const newAccountResult = await pool.query(
            `INSERT INTO lol_accounts 
             (user_id, login_username, login_password, summoner_name, server) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, login_username, summoner_name, server`,
            [userId, username, hashedPassword, summoner_name, server]
          );
          
          newAccount = { ...newAccountResult.rows[0], favorite: false };
        }
      }
    } catch (dbError) {
      console.log('Using in-memory storage due to database error:', dbError.message);
      // If all database attempts fail, add to in-memory storage
      const id = nextAccountId++;
      const account = {
        id,
        user_id: userId,
        login_username: username,
        login_password: hashedPassword,
        login_password_encrypted: encryptedPassword,
        raw_password: password, // Store raw password in memory for development only
        summoner_name,
        server,
        favorite: false,
        created_at: new Date().toISOString()
      };
      
      inMemoryAccounts.push(account);
      
      newAccount = {
        id,
        login_username: username,
        summoner_name,
        server,
        favorite: false
      };
    }
    
    // Add decrypted password for the frontend (only for the response)
    newAccount.decrypted_password = password;
    
    res.status(201).json({
      message: 'Account added successfully',
      account: newAccount
    });
  } catch (error) {
    console.error('Add account error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Update an account
app.put('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const accountId = req.params.id;
    const userId = req.user.userId;
    const updateData = req.body;
    
    console.log('Updating account:', accountId, 'with data:', updateData);
    
    // In-memory favorite handling - simpler and more reliable
    if (updateData.favorite !== undefined) {
      // Find account in memory first
      const accountIndex = inMemoryAccounts.findIndex(a => a.id === parseInt(accountId) && a.user_id === userId);
      
      if (accountIndex !== -1) {
        // Update the favorite status in memory
        inMemoryAccounts[accountIndex].favorite = updateData.favorite;
        console.log(`Set favorite=${updateData.favorite} for account ${accountId} in memory`);
      }
      
      // Also try to update in database without causing errors
      try {
        await pool.query(
          `UPDATE lol_accounts 
           SET favorite = $1
           WHERE id = $2 AND user_id = $3`,
          [updateData.favorite, accountId, userId]
        );
        console.log(`Updated favorite in database successfully`);
      } catch (error) {
        // Silently handle this error - we've already updated in memory
        console.log('Could not update favorite in database, using in-memory only');
      }
      
      // Get the account to return
      let account;
      try {
        const result = await pool.query(
          'SELECT * FROM lol_accounts WHERE id = $1 AND user_id = $2',
          [accountId, userId]
        );
        
        if (result.rows.length > 0) {
          account = result.rows[0];
          // Add the favorite field from memory
          account.favorite = updateData.favorite;
        } else {
          // If not found in database, check memory
          account = inMemoryAccounts.find(a => a.id === parseInt(accountId) && a.user_id === userId);
        }
      } catch (error) {
        // If database query fails, use in-memory
        account = inMemoryAccounts.find(a => a.id === parseInt(accountId) && a.user_id === userId);
      }
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found or not authorized' });
      }
      
      // Try to include decrypted password if available
      if (account.login_password_encrypted) {
        try {
          const decryptedPassword = decrypt(account.login_password_encrypted);
          if (decryptedPassword) {
            account.decrypted_password = decryptedPassword;
          }
        } catch (e) {
          // Ignore decryption errors
        }
      } else if (account.raw_password) {
        account.decrypted_password = account.raw_password;
      }
      
      return res.json({
        message: 'Account updated successfully',
        account: {
          id: account.id,
          login_username: account.login_username,
          summoner_name: account.summoner_name,
          server: account.server,
          favorite: account.favorite,
          decrypted_password: account.decrypted_password
        }
      });
    }
    
    // For non-favorite updates, use the normal approach
    try {
      // Check if account exists and belongs to user
      const accountCheck = await pool.query(
        'SELECT * FROM lol_accounts WHERE id = $1 AND user_id = $2',
        [accountId, userId]
      );
      
      if (accountCheck.rows.length === 0) {
        // Try checking in-memory accounts
        const memoryAccount = inMemoryAccounts.find(a => a.id === parseInt(accountId) && a.user_id === userId);
        if (!memoryAccount) {
          return res.status(404).json({ error: 'Account not found or not authorized' });
        }
        
        // Update the account in memory
        Object.assign(memoryAccount, updateData);
        
        return res.json({
          message: 'Account updated successfully (in-memory)',
          account: {
            id: memoryAccount.id,
            login_username: memoryAccount.login_username,
            summoner_name: memoryAccount.summoner_name,
            server: memoryAccount.server,
            favorite: memoryAccount.favorite || false,
            decrypted_password: memoryAccount.raw_password || null
          }
        });
      }
      
      // Build dynamic SQL for update
      const fields = Object.keys(updateData).filter(field => field !== 'favorite');
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid update fields provided' });
      }
      
      const values = fields.map(field => updateData[field]);
      const placeholders = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
      
      // Add WHERE clause parameters
      values.push(accountId);
      values.push(userId);
      
      const query = `
        UPDATE lol_accounts 
        SET ${placeholders} 
        WHERE id = $${values.length - 1} AND user_id = $${values.length} 
        RETURNING id, login_username, summoner_name, server
      `;
      
      const result = await pool.query(query, values);
      
      // Get favorite status from in-memory if available
      const memAccount = inMemoryAccounts.find(a => a.id === parseInt(accountId));
      const favorite = memAccount ? memAccount.favorite : false;
      
      return res.json({
        message: 'Account updated successfully',
        account: {
          ...result.rows[0],
          favorite
        }
      });
      
    } catch (error) {
      console.error('Update error:', error);
      return res.status(500).json({ error: 'Error updating account: ' + error.message });
    }
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Delete an account
app.delete('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const accountId = req.params.id;
    const userId = req.user.userId;
    
    // Check if account belongs to user
    let accountBelongsToUser = false;
    
    try {
      const account = await pool.query(
        'SELECT * FROM lol_accounts WHERE id = $1 AND user_id = $2',
        [accountId, userId]
      );
      
      accountBelongsToUser = account.rows.length > 0;
    } catch (dbError) {
      console.log('Using in-memory check due to database error:', dbError.message);
      const account = inMemoryAccounts.find(a => a.id === parseInt(accountId) && a.user_id === userId);
      accountBelongsToUser = !!account;
    }
    
    if (!accountBelongsToUser) {
      return res.status(404).json({ error: 'Account not found or not authorized' });
    }
    
    // Delete account
    try {
      await pool.query('DELETE FROM lol_accounts WHERE id = $1', [accountId]);
    } catch (dbError) {
      console.log('Using in-memory storage due to database error:', dbError.message);
      // If database query fails, delete from in-memory storage
      const accountIndex = inMemoryAccounts.findIndex(a => a.id === parseInt(accountId));
      
      if (accountIndex !== -1) {
        inMemoryAccounts.splice(accountIndex, 1);
        
        // Also remove any associated flairs
        const flairIndices = [];
        inMemoryAccountFlairs.forEach((flair, index) => {
          if (flair.account_id === parseInt(accountId)) {
            flairIndices.unshift(index); // Add to front of array to delete from end to start
          }
        });
        
        flairIndices.forEach(index => {
          inMemoryAccountFlairs.splice(index, 1);
        });
      }
    }
    
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
    let flairs;
    
    try {
      // Try to get flairs from database
      const flairsResult = await pool.query('SELECT * FROM flairs');
      flairs = flairsResult.rows;
    } catch (dbError) {
      console.log('Using default flairs due to database error:', dbError.message);
      // If database query fails, use default flairs
      flairs = defaultFlairs;
    }
    
    res.json(flairs);
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
    
    let accountBelongsToUser = false;
    
    try {
      // Check if account belongs to user in database
      const account = await pool.query(
        'SELECT * FROM lol_accounts WHERE id = $1 AND user_id = $2',
        [accountId, userId]
      );
      
      accountBelongsToUser = account.rows.length > 0;
    } catch (dbError) {
      console.log('Using in-memory check due to database error:', dbError.message);
      // If database query fails, check in-memory storage
      const account = inMemoryAccounts.find(a => a.id === parseInt(accountId) && a.user_id === userId);
      accountBelongsToUser = !!account;
    }
    
    if (!accountBelongsToUser) {
      return res.status(404).json({ error: 'Account not found or not authorized' });
    }
    
    let flairAlreadyAdded = false;
    
    try {
      // Check if flair already added in database
      const existingFlair = await pool.query(
        'SELECT * FROM account_flairs WHERE account_id = $1 AND flair_id = $2',
        [accountId, flairId]
      );
      
      flairAlreadyAdded = existingFlair.rows.length > 0;
    } catch (dbError) {
      console.log('Using in-memory check due to database error:', dbError.message);
      // If database query fails, check in-memory storage
      const existingFlair = inMemoryAccountFlairs.find(
        f => f.account_id === parseInt(accountId) && f.flair_id === parseInt(flairId)
      );
      flairAlreadyAdded = !!existingFlair;
    }
    
    if (flairAlreadyAdded) {
      return res.status(409).json({ error: 'Flair already added to this account' });
    }
    
    try {
      // Add flair to account in database
      await pool.query(
        'INSERT INTO account_flairs (account_id, flair_id) VALUES ($1, $2)',
        [accountId, flairId]
      );
    } catch (dbError) {
      console.log('Using in-memory storage due to database error:', dbError.message);
      // If database query fails, add to in-memory storage
      inMemoryAccountFlairs.push({
        account_id: parseInt(accountId),
        flair_id: parseInt(flairId)
      });
    }
    
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
    
    let accountBelongsToUser = false;
    
    try {
      // Check if account belongs to user in database
      const account = await pool.query(
        'SELECT * FROM lol_accounts WHERE id = $1 AND user_id = $2',
        [accountId, userId]
      );
      
      accountBelongsToUser = account.rows.length > 0;
    } catch (dbError) {
      console.log('Using in-memory check due to database error:', dbError.message);
      // If database query fails, check in-memory storage
      const account = inMemoryAccounts.find(a => a.id === parseInt(accountId) && a.user_id === userId);
      accountBelongsToUser = !!account;
    }
    
    if (!accountBelongsToUser) {
      return res.status(404).json({ error: 'Account not found or not authorized' });
    }
    
    try {
      // Remove flair from account in database
      await pool.query(
        'DELETE FROM account_flairs WHERE account_id = $1 AND flair_id = $2',
        [accountId, flairId]
      );
    } catch (dbError) {
      console.log('Using in-memory storage due to database error:', dbError.message);
      // If database query fails, remove from in-memory storage
      const index = inMemoryAccountFlairs.findIndex(
        f => f.account_id === parseInt(accountId) && f.flair_id === parseInt(flairId)
      );
      
      if (index !== -1) {
        inMemoryAccountFlairs.splice(index, 1);
      }
    }
    
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
    
    // Get the API key from environment variables
    const apiKey = process.env.RIOT_API_KEY;
    
    // Check if API key is available
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'Riot API key not configured', 
        message: 'Please set the RIOT_API_KEY in your .env file'
      });
    }
    
    console.log("Using Riot API Key (first 5 chars):", apiKey.substring(0, 5) + "...");
    
    // Validate server
    const validServers = ['na1', 'euw1', 'eun1', 'kr', 'br1', 'jp1', 'ru', 'oc1', 'tr1', 'la1', 'la2'];
    if (!validServers.includes(server.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid server' });
    }
    
    // Mock data for development when API key is invalid or for testing
    if (apiKey === 'DEVELOPMENT_MODE' || process.env.MOCK_RIOT_API === 'true') {
      console.log('Using mock Riot API data');
      const mockData = {
        summoner: {
          id: "mock-summoner-id",
          accountId: "mock-account-id",
          puuid: "mock-puuid",
          name: summonerName,
          profileIconId: 4087,
          revisionDate: Date.now(),
          summonerLevel: 245
        },
        ranked: [
          {
            leagueId: "mock-league-id",
            queueType: "RANKED_SOLO_5x5",
            tier: "PLATINUM",
            rank: "II",
            summonerId: "mock-summoner-id",
            summonerName: summonerName,
            leaguePoints: 54,
            wins: 153,
            losses: 147,
            veteran: false,
            inactive: false,
            freshBlood: false,
            hotStreak: false
          }
        ]
      };
      
      return res.json(mockData);
    }
    
    try {
      // Get summoner by name from Riot API
      const summonerResponse = await axios.get(
        `https://${server}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`,
        {
          headers: {
            'X-Riot-Token': apiKey
          }
        }
      );
      
      const summoner = summonerResponse.data;
      
      // Get ranked data for the summoner
      const rankedResponse = await axios.get(
        `https://${server}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summoner.id}`,
        {
          headers: {
            'X-Riot-Token': apiKey
          }
        }
      );
      
      // Return combined data
      res.json({
        summoner,
        ranked: rankedResponse.data
      });
    } catch (error) {
      console.error('Riot API error details:', error.response?.data || error.message);
      console.error('Status code:', error.response?.status);
      
      if (error.response?.status === 404) {
        return res.status(404).json({ error: 'Summoner not found' });
      }
      
      if (error.response?.status === 403) {
        return res.status(403).json({ 
          error: 'Invalid or expired Riot API key',
          details: 'Riot API keys typically expire after 24 hours for development keys. You can set MOCK_RIOT_API=true in your .env file to use mock data for development.'
        });
      }
      
      res.status(500).json({ 
        error: 'Error fetching data from Riot API',
        message: error.message,
        status: error.response?.status,
        solution: 'Set MOCK_RIOT_API=true in your .env file to use mock data for development.'
      });
    }
  } catch (error) {
    console.error('General error in Riot API route:', error);
    res.status(500).json({ error: 'Server error processing Riot API request' });
  }
});

// ============ DATABASE MANAGEMENT ROUTES ============

// Add login_password_encrypted column to lol_accounts table
app.post('/api/admin/add-encrypted-password-column', async (req, res) => {
  try {
    // This should be protected with an admin authentication in production
    const adminKey = req.headers['admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    try {
      // Check if column already exists
      const checkResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'lol_accounts' AND column_name = 'login_password_encrypted'
      `);
      
      if (checkResult.rows.length > 0) {
        return res.json({ message: 'Column already exists' });
      }
      
      // Add the column
      await pool.query(`
        ALTER TABLE lol_accounts 
        ADD COLUMN login_password_encrypted TEXT
      `);
      
      res.json({ message: 'Column added successfully' });
    } catch (error) {
      console.error('Error adding column:', error);
      res.status(500).json({ error: 'Database error' });
    }
  } catch (error) {
    console.error('Admin route error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add favorite column to lol_accounts table
app.post('/api/admin/add-favorite-column', async (req, res) => {
  try {
    // This should be protected with an admin authentication in production
    const adminKey = req.headers['admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    try {
      // Check if column already exists
      const checkResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'lol_accounts' AND column_name = 'favorite'
      `);
      
      if (checkResult.rows.length > 0) {
        return res.json({ message: 'Column already exists' });
      }
      
      // Add the column
      await pool.query(`
        ALTER TABLE lol_accounts 
        ADD COLUMN favorite BOOLEAN DEFAULT false
      `);
      
      res.json({ message: 'Column added successfully' });
    } catch (error) {
      console.error('Error adding column:', error);
      res.status(500).json({ error: 'Database error' });
    }
  } catch (error) {
    console.error('Admin route error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create flairs table if it doesn't exist
app.post('/api/admin/create-flairs-table', async (req, res) => {
  try {
    // This should be protected with an admin authentication in production
    const adminKey = req.headers['admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    try {
      // Create flairs table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS flairs (
          id SERIAL PRIMARY KEY,
          flair_name VARCHAR(255) NOT NULL,
          flair_color VARCHAR(50) NOT NULL
        )
      `);
      
      // Create account_flairs junction table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS account_flairs (
          account_id INTEGER REFERENCES lol_accounts(id) ON DELETE CASCADE,
          flair_id INTEGER REFERENCES flairs(id) ON DELETE CASCADE,
          PRIMARY KEY (account_id, flair_id)
        )
      `);
      
      // Check if default flairs exist
      const flairsResult = await pool.query('SELECT * FROM flairs');
      
      // If no flairs exist, insert default flairs
      if (flairsResult.rows.length === 0) {
        for (const flair of defaultFlairs) {
          await pool.query(
            'INSERT INTO flairs (id, flair_name, flair_color) VALUES ($1, $2, $3)',
            [flair.id, flair.flair_name, flair.flair_color]
          );
        }
      }
      
      res.json({ message: 'Flairs tables created and populated successfully' });
    } catch (error) {
      console.error('Error creating flairs tables:', error);
      res.status(500).json({ error: 'Database error' });
    }
  } catch (error) {
    console.error('Admin route error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});