# Ice Cream Booth Reporting App

A beginner-friendly local web app for daily ice cream booth reports. It tracks sales, costs, expenses, profit, stock alerts, monthly summaries, and backups for Google Sheets or Excel.

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open the local URL shown in the terminal, usually `http://127.0.0.1:5173`.

## Add A Daily Report

1. Open **Daily Report**.
2. Pick the report date.
3. Enter quantities for each menu item.
4. Optionally add flavor breakdowns for `1 Kugle`, `2 Kugler`, and `3 Kugler`.
5. Add any expenses for the day.
6. Check the live sales, moms/VAT, product cost, gross profit, expenses, and net profit.
7. Press **Save report**.

The seeded example report for `23/05/2026` contains:

- `Drys`: 3
- `1 Kugle`: 48
- `2 Kugler`: 44
- `3 Kugler`: 1

That report calculates to `4.060 kr.` sales incl. moms, `3.248 kr.` sales ex. moms, and `812 kr.` sales moms.

## Dashboard Overview

Open **Dashboard** and use the period filter for **Today**, **This week**, or **This month**. The dashboard shows one period at a time and includes **Shop Quest**, a light gamification panel with goal progress, report streak, scoop score, and achievement badges.

Open **Product Pricing** to edit the daily sales goal used by Shop Quest. The default is `800 kr.` per day, shown as `800 kr.` today, `5.600 kr.` weekly, and `24.000 kr.` monthly.

## Add Stock Items

Open **Stock**.

- Use **Add stock item** for any ingredient, packaging item, cleaning supply, or other stock row.
- Use **Add ice cream tub** to quickly create a separate tub row for a selected flavor.
- Edit unit, starting stock, quick added stock, manual used stock, minimum stock level, notes, and linked product.
- Use **Stock Movement Log** for received stock, used stock, waste, and adjustments with dates and notes.
- If a row is linked to a product, sales of that product are included in used stock.
- For ice cream tubs, leave linked product as **Manual** and log **Used** or **Waste** when tubs are finished or discarded.

## Import A Text Report

Open **Import Report** and paste a line such as:

```text
24/05: Alm. Softice 12, 1 Kugle 8, 2 Kugler 5, Guf 4, Drys 3, expenses 250 kr ice cream purchase
```

Press **Parse report**. The app shows a draft first, then you can open it in **Daily Report** and correct anything before saving.

## Add Expenses

Open **Expenses**.

- Use **Quick Add Expense** for one-off purchases and random items.
- Use the shortcut chips for common items such as **Cash register**, **Random item**, **Toppings/guf**, and **Ice cream purchase**.
- Use **Monthly Expenses** for recurring payments. The seed data includes a **Cash register system** monthly template; enter the monthly amount and click **Add to month** when the bill should be recorded.
- Expense amounts are entered in DKK and split into moms columns automatically.

## Export Data

Open **Export** and choose:

- Daily reports CSV
- Product pricing CSV
- Expenses CSV
- Stock CSV
- Stock history CSV
- Monthly summary CSV
- Full backup JSON
- Workbook XLSX

CSV files can be imported into Google Sheets. The JSON backup is the best full-app backup.

## Shared Data With Supabase

The app can sync one shared data file through Supabase, so you and a partner can use the same reports.

1. Create a free project at Supabase.
2. Open Supabase **SQL Editor**.
3. Copy and run the contents of `supabase-setup.sql`.
4. In Supabase, copy your **Project URL** and **anon public key** from **Project Settings → API**.
5. Open the app, go to **Export → Shared Supabase Sync**.
6. Paste the URL and anon key.
7. Click **Test connection**.
8. Click **Push this browser to cloud** to seed Supabase with your current app data.
9. Turn on **Enable shared cloud sync**.

On your partner's browser, repeat steps 5-7, turn on cloud sync, then click **Load from cloud**.

This simple setup has no login. Anyone with the app URL and anon key can edit the shared data, so use it for trusted people only.

## Deployment Recovery

If Netlify deploys are paused or the team has hit a credit limit, use `DEPLOYMENT_RECOVERY.md`.

The short version:

- The app is static and still builds locally with `npm run build`.
- Fresh free hosting recommendation: Cloudflare Pages.
- Build command: `npm run build`.
- Publish/output directory: `dist`.
- GitHub Pages is also prepared through `.github/workflows/deploy-pages.yml`.

## Reset Or Backup Data

Data is stored locally in your browser using `localStorage`.

- To back up everything, use **Export → Full backup JSON**.
- To reset the app to seed data, use **Export → Reset local data**.
- Resetting only affects the browser you are using.

## Moms/VAT, Product Costs, And Guf

Open **Product Pricing** to edit selling prices, costs, and VAT/moms settings.

The default setup follows normal Danish VAT handling for a moms-registered booth:

- Moms rate is `25%`.
- Sales prices are entered incl. moms because that is what customers pay at the booth.
- Product costs and expenses are entered incl. moms by default.
- Profit is calculated ex. moms because moms is collected for, or reclaimed from, Skattestyrelsen.
- Moms payable is calculated as sales moms minus deductible moms on product costs and expenses.

Guf cost is calculated automatically:

```text
cost per guf portion = guf bucket price including moms / portions per bucket
```

The default bucket price is `639,66 kr.` excluding moms, with Danish moms set to `25%`.

## Checks

```bash
npm run lint
npm run test:logic
npm run test:ui
npm run build
```
