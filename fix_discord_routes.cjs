const fs = require('fs');
let code = fs.readFileSync('server/routes/discord.ts', 'utf8');

code = code.replace(/botToken: 'bot_token_secret_aether_live_prod_2026',/g, `botToken: '',`);
code = code.replace(/clientId: '109283749281729384',/g, `clientId: '',`);
code = code.replace(/clientSecret: 'discord_client_secret_masked',/g, `clientSecret: '',`);
code = code.replace(/defaultWebhookUrl: 'https:\/\/discord\.com\/api\/webhooks\/demo\/aetherpanel-notifications',/g, `defaultWebhookUrl: '',`);
code = code.replace(/botStatus: 'online',/g, `botStatus: 'offline',`);

fs.writeFileSync('server/routes/discord.ts', code);
