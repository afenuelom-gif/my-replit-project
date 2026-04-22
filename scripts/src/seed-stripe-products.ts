import { getUncachableStripeClient } from "./stripeClient.js";

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log("Creating PrepInterv AI products in Stripe...");

    // ── Starter Plan ──────────────────────────────────────────────────────────
    const existingStarter = await stripe.products.search({ query: "name:'Starter' AND active:'true'" });
    let starterProductId: string;

    if (existingStarter.data.length > 0) {
      console.log("Starter plan already exists, skipping.");
      starterProductId = existingStarter.data[0].id;
    } else {
      const starter = await stripe.products.create({
        name: "Starter",
        description: "4 interview sessions per month + 1 resume tailor",
        metadata: {
          plan: "starter",
          session_credits: "4",
          resume_tailoring_credits: "1",
        },
      });
      starterProductId = starter.id;
      console.log(`Created Starter product: ${starter.id}`);

      await stripe.prices.create({
        product: starter.id,
        unit_amount: 1200,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { plan: "starter" },
      });
      console.log("Created Starter price: $12.00/month");
    }

    // ── Pro Plan ──────────────────────────────────────────────────────────────
    const existingPro = await stripe.products.search({ query: "name:'Pro' AND active:'true'" });
    let proProductId: string;

    if (existingPro.data.length > 0) {
      console.log("Pro plan already exists, skipping.");
      proProductId = existingPro.data[0].id;
    } else {
      const pro = await stripe.products.create({
        name: "Pro",
        description: "Unlimited interview sessions + 3 resume tailors per month",
        metadata: {
          plan: "pro",
          session_credits: "999",
          resume_tailoring_credits: "3",
        },
      });
      proProductId = pro.id;
      console.log(`Created Pro product: ${pro.id}`);

      await stripe.prices.create({
        product: pro.id,
        unit_amount: 2400,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { plan: "pro" },
      });
      console.log("Created Pro price: $24.00/month");
    }

    // ── Resume Tailor Top-Up Packs ────────────────────────────────────────────
    const topUpConfigs = [
      { name: "Resume Tailor — 1 Credit", amount: 300, credits: 1 },
      { name: "Resume Tailor — 3 Credits", amount: 700, credits: 3 },
      { name: "Resume Tailor — 10 Credits", amount: 2000, credits: 10 },
    ];

    for (const config of topUpConfigs) {
      const existing = await stripe.products.search({ query: `name:'${config.name}' AND active:'true'` });
      if (existing.data.length > 0) {
        console.log(`${config.name} already exists, skipping.`);
        continue;
      }

      const product = await stripe.products.create({
        name: config.name,
        description: `Add ${config.credits} resume tailor credit${config.credits > 1 ? "s" : ""} to your account`,
        metadata: {
          type: "topup",
          resume_tailoring_credits: String(config.credits),
        },
      });
      console.log(`Created ${config.name}: ${product.id}`);

      await stripe.prices.create({
        product: product.id,
        unit_amount: config.amount,
        currency: "usd",
        metadata: {
          type: "topup",
          resume_tailoring_credits: String(config.credits),
        },
      });
      console.log(`  Price: $${(config.amount / 100).toFixed(2)} one-time`);
    }

    console.log("\nAll products created successfully!");
    console.log("Webhooks will sync this data to your database automatically.");
  } catch (error: unknown) {
    console.error("Error creating products:", (error as Error).message);
    process.exit(1);
  }
}

createProducts();
