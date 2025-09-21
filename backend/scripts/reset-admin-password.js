const bcrypt = require('bcryptjs');
const { query } = require('../src/database/connection');

async function resetAdminPassword() {
    try {
        const newPassword = 'admin123'; // You can change this password
        const username = 'max';
        
        // Hash the new password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);
        
        // Update the user's password
        await query(`
            UPDATE users 
            SET password_hash = $1 
            WHERE username = $2
        `, [passwordHash, username]);
        
        console.log(`✅ Password for user '${username}' has been reset successfully!`);
        console.log(`🔑 New password: ${newPassword}`);
        console.log(`⚠️  Please change this password after logging in!`);
        
    } catch (error) {
        console.error('❌ Error resetting password:', error);
    } finally {
        process.exit(0);
    }
}

resetAdminPassword();
