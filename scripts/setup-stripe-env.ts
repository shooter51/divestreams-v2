/**
 * Stripe Environment Setup Helper
 *
 * This script helps validate your Stripe configuration and provides
 * guidance on setting up API keys and webhook secrets.
 *
 * Usage: npx tsx scripts/setup-stripe-env.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface EnvConfig {
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_STARTER_PRICE_MONTHLY?: string;
  STRIPE_STARTER_PRICE_YEARLY?: string;
  STRIPE_PRO_PRICE_MONTHLY?: string;
  STRIPE_PRO_PRICE_YEARLY?: string;
  STRIPE_ENTERPRISE_PRICE_MONTHLY?: string;
  STRIPE_ENTERPRISE_PRICE_YEARLY?: string;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

function validateStripeKey(key: string, expectedPrefix: string): boolean {
  return key.startsWith(expectedPrefix) && key.length > 20;
}

function validatePriceId(priceId: string): boolean {
  return priceId.startsWith('price_') && priceId.length > 10;
}

function readEnvFile(envPath: string): EnvConfig {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  const config: EnvConfig = {};

  content.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();

    if (key && value && key.startsWith('STRIPE_')) {
      config[key as keyof EnvConfig] = value;
    }
  });

  return config;
}

function writeEnvFile(envPath: string, config: EnvConfig): void {
  let content = '';

  if (fs.existsSync(envPath)) {
    // Preserve non-Stripe vars
    const existing = fs.readFileSync(envPath, 'utf-8');
    content = existing
      .split('\n')
      .filter((line) => !line.startsWith('STRIPE_'))
      .join('\n')
      .trim();
    content += '\n\n';
  }

  // Write Stripe config
  content += '# Stripe Configuration\n';
  content += `STRIPE_SECRET_KEY=${config.STRIPE_SECRET_KEY || 'sk_test_...'}\n`;
  content += `STRIPE_PUBLISHABLE_KEY=${config.STRIPE_PUBLISHABLE_KEY || 'pk_test_...'}\n`;
  content += `STRIPE_WEBHOOK_SECRET=${config.STRIPE_WEBHOOK_SECRET || 'whsec_...'}\n`;
  content += '\n# Stripe Price IDs\n';
  content += `STRIPE_STARTER_PRICE_MONTHLY=${config.STRIPE_STARTER_PRICE_MONTHLY || 'price_...'}\n`;
  content += `STRIPE_STARTER_PRICE_YEARLY=${config.STRIPE_STARTER_PRICE_YEARLY || 'price_...'}\n`;
  content += `STRIPE_PRO_PRICE_MONTHLY=${config.STRIPE_PRO_PRICE_MONTHLY || 'price_...'}\n`;
  content += `STRIPE_PRO_PRICE_YEARLY=${config.STRIPE_PRO_PRICE_YEARLY || 'price_...'}\n`;
  content += `STRIPE_ENTERPRISE_PRICE_MONTHLY=${config.STRIPE_ENTERPRISE_PRICE_MONTHLY || 'price_...'}\n`;
  content += `STRIPE_ENTERPRISE_PRICE_YEARLY=${config.STRIPE_ENTERPRISE_PRICE_YEARLY || 'price_...'}\n`;
  content += '\n';

  fs.writeFileSync(envPath, content);
}

async function main(): Promise<void> {
  console.log('\n🔑 Stripe Configuration Helper\n');
  console.log('This tool will help you set up your Stripe API keys and prices.\n');

  const envPath = path.join(process.cwd(), '.env');
  const examplePath = path.join(process.cwd(), '.env.example');

  // Check if .env exists
  if (!fs.existsSync(envPath)) {
    console.log('📝 Creating .env file...\n');
    fs.copyFileSync(examplePath, envPath);
    console.log(`✅ Created .env from .env.example\n`);
  }

  const config = readEnvFile(envPath);

  // Check existing keys
  console.log('Checking current configuration...\n');

  const hasSecretKey = config.STRIPE_SECRET_KEY && validateStripeKey(config.STRIPE_SECRET_KEY, 'sk_');
  const hasPublishableKey = config.STRIPE_PUBLISHABLE_KEY && validateStripeKey(config.STRIPE_PUBLISHABLE_KEY, 'pk_');
  const hasWebhookSecret = config.STRIPE_WEBHOOK_SECRET && config.STRIPE_WEBHOOK_SECRET.startsWith('whsec_');

  console.log(`${hasSecretKey ? '✅' : '❌'} Stripe Secret Key: ${hasSecretKey ? '✓' : 'Not configured'}`);
  console.log(`${hasPublishableKey ? '✅' : '❌'} Stripe Publishable Key: ${hasPublishableKey ? '✓' : 'Not configured'}`);
  console.log(`${hasWebhookSecret ? '✅' : '❌'} Webhook Secret: ${hasWebhookSecret ? '✓' : 'Not configured'}`);
  console.log('\n');

  // Prompt for keys if missing
  if (!hasSecretKey) {
    console.log('📋 Get your Secret Key from: https://dashboard.stripe.com/developers/api');
    const secretKey = await question('Enter your Stripe Secret Key (sk_test_...): ');

    if (validateStripeKey(secretKey, 'sk_')) {
      config.STRIPE_SECRET_KEY = secretKey;
      console.log('✅ Secret Key saved\n');
    } else {
      console.log('❌ Invalid Secret Key format. Expected sk_test_... or sk_live_...\n');
    }
  }

  if (!hasPublishableKey) {
    const publishableKey = await question('Enter your Stripe Publishable Key (pk_test_...): ');

    if (validateStripeKey(publishableKey, 'pk_')) {
      config.STRIPE_PUBLISHABLE_KEY = publishableKey;
      console.log('✅ Publishable Key saved\n');
    } else {
      console.log('❌ Invalid Publishable Key format. Expected pk_test_... or pk_live_...\n');
    }
  }

  // Price IDs
  console.log('💰 Now let\'s configure your pricing.\n');
  console.log('Go to: https://dashboard.stripe.com/products');
  console.log('Create products named: Starter, Pro, Enterprise');
  console.log('For each product, create monthly and yearly prices.\n');

  const priceIds: (keyof EnvConfig)[] = [
    'STRIPE_STARTER_PRICE_MONTHLY',
    'STRIPE_STARTER_PRICE_YEARLY',
    'STRIPE_PRO_PRICE_MONTHLY',
    'STRIPE_PRO_PRICE_YEARLY',
    'STRIPE_ENTERPRISE_PRICE_MONTHLY',
    'STRIPE_ENTERPRISE_PRICE_YEARLY',
  ];

  for (const priceKey of priceIds) {
    if (!config[priceKey] || config[priceKey] === 'price_...') {
      const plan = priceKey
        .replace('STRIPE_', '')
        .replace('_PRICE_', ' ')
        .toLowerCase();

      const priceId = await question(`Enter Price ID for ${plan} (price_...): `);

      if (validatePriceId(priceId)) {
        config[priceKey] = priceId;
        console.log(`✅ Saved\n`);
      } else {
        console.log(`❌ Invalid Price ID format. Skipping...\n`);
      }
    }
  }

  // Webhook secret
  if (!hasWebhookSecret) {
    console.log('🔐 Set up webhooks:\n');
    console.log('1. Go to: https://dashboard.stripe.com/webhooks');
    console.log('2. Add an endpoint with URL: https://yourdomain.com/api/webhooks/stripe');
    console.log('3. Select events (see STRIPE_SETUP.md for complete list)');
    console.log('4. Copy the Signing Secret (whsec_...)\n');

    const webhookSecret = await question('Enter Webhook Secret (whsec_...) [optional]: ');

    if (webhookSecret && webhookSecret.startsWith('whsec_')) {
      config.STRIPE_WEBHOOK_SECRET = webhookSecret;
      console.log('✅ Webhook Secret saved\n');
    } else if (webhookSecret) {
      console.log('⚠️  Invalid format. Skipping webhook setup for now.\n');
    }
  }

  // Save to .env
  writeEnvFile(envPath, config);

  console.log('✅ Configuration saved to .env\n');
  console.log('📚 Next steps:\n');
  console.log('1. Read STRIPE_SETUP.md for detailed configuration guide');
  console.log('2. Run: npm run db:seed');
  console.log('3. Test with: npm run dev');
  console.log('4. Visit: http://localhost:5173/billing\n');

  rl.close();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
