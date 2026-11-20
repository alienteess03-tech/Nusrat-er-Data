# নুসরাতের সংসার — Vercel Web App

এটি একটি সাধারণ ওয়েব অ্যাপ। PWA/Android APK বা `app.py` প্রয়োজন নেই। Vercel-এর `/api` serverless functions PIN ও Cloud Data পরিচালনা করে; পরিবারের ডেটা Supabase Postgres-এ থাকে।

## কী আছে

- ওয়েবসাইট খুললেই ৪ সংখ্যার PIN gate; PIN `1953` সার্ভারে environment variable হিসেবে সেট করতে হবে।
- PIN সঠিক হলে একই পরিবারের সব ডেটা দেখা ও পরিবর্তন করা যায়। আলাদা user/account নেই—যার কাছে PIN থাকবে, সে একই ডেটাবেস ব্যবহার করতে পারবে।
- আয়-ব্যয়, বাজেট, recurring খরচ, ঋণ, EMI, সঞ্চয়ের পকেট, অ্যাকাউন্ট, বিল ও সেটিংস ক্লাউডে সংরক্ষণ হয়।
- অন্য ডিভাইসের পরিবর্তন সাধারণত ৫ সেকেন্ডের মধ্যে রিফ্রেশ হয়। একসঙ্গে আলাদা রেকর্ড যোগ হলে server-side merge করার ব্যবস্থা আছে।
- আগের `hisab_data_v3` localStorage format রাখা হয়েছে।
- Backup / Restore ও CSV export ফিচার রাখা হয়েছে।

## ১) Supabase Database তৈরি

1. https://supabase.com এ নতুন Project তৈরি করুন।
2. Project-এর **SQL Editor** খুলুন।
3. এই ফোল্ডারের `database.sql` ফাইলের পুরো SQL কপি করে Run করুন।
4. Project Settings → API Keys থেকে **Secret key** কপি করুন। নতুন key সাধারণত `sb_secret_` দিয়ে শুরু হয়।
5. Project URL কপি করুন (যেমন `https://abcxyz.supabase.co`)।

গুরুত্বপূর্ণ: `sb_secret_...` key কখনো HTML, JavaScript, GitHub বা chat-এ বসাবেন না। এটি শুধু Vercel server environment variable-এ থাকবে। SQL-এ browser roles-এর access বন্ধ এবং RLS চালু করা আছে।

## ২) Vercel-এ Deploy

1. পুরো project folder GitHub repository-তে upload করুন। Root folder-এ `index.html`, `api/`, `lib/`, `database.sql`, `package.json`, `vercel.json` থাকতে হবে।
2. Vercel → **Add New → Project** → সেই GitHub repository Import করুন। Framework Preset: **Other**; Build Command ও Output Directory ফাঁকা/default রাখুন।
3. Deploy করার আগে বা পরে Project → Settings → Environment Variables-এ নিচের ৪টি variable যোগ করুন:

| Name | Value |
|---|---|
| `APP_PIN` | আপনার ৪ সংখ্যার PIN (Vercel-এ `1953` সেট করুন; source code-এ নয়) |
| `SESSION_SECRET` | কমপক্ষে ৩২ অক্ষরের একটি random secret |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SECRET_KEY` | Supabase `sb_secret_...` key |

`SESSION_SECRET` বানানোর জন্য নিজের কম্পিউটারে Node.js চালিয়ে এই কমান্ড ব্যবহার করতে পারেন:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

4. সব Environment Variable যোগ করার পর **Redeploy** করুন।
5. Vercel URL খুলে আপনার নির্ধারিত PIN দিয়ে প্রবেশ করুন। Session ১৪ দিন পর্যন্ত থাকে; লগ আউট করলে cookie মুছে যায়।

## ৩) অন্য ফোনে ব্যবহার

একই Vercel URL সিয়াম, নুসরাত বা পরিবারের অন্য সদস্যের ফোনে খুলুন। একই PIN দিন। আলাদা Firebase config বা Family Sync Code লাগবে না। একজন যে হিসাব সেভ করবে, অন্য ডিভাইসগুলোতে সেটি সাধারণত কয়েক সেকেন্ডের মধ্যে দেখা যাবে।

## ৪) পুরোনো হিসাব নিয়ে গুরুত্বপূর্ণ

অ্যাপের পুরোনো হিসাব যদি একই domain/browser-এর localStorage-এ থাকে, প্রথমবার database খালি থাকলে প্রথম login-এর সময় সেটি ক্লাউডে upload হবে। Domain বদলালে browser পুরোনো localStorage স্বয়ংক্রিয়ভাবে নতুন domain-এ দেয় না। সে ক্ষেত্রে পুরোনো অ্যাপ থেকে **Backup Data** নিয়ে নতুন ওয়েবসাইটে PIN দিয়ে ঢুকে **Restore Data** করুন। Restore করার পর অন্য ফোনে নতুন করে রিফ্রেশ করুন।

প্রথমে যে ডিভাইসে আসল পুরোনো ডেটা আছে, সেই ডিভাইস থেকেই প্রথম login/restore করা ভালো।

## ৫) PIN ও গোপনীয়তা

- `1953` একটি ছোট shared PIN; এটি শক্তিশালী individual authentication নয়। যার কাছে PIN থাকবে, সে ডেটা দেখতে ও edit করতে পারবে।
- PIN JavaScript-এ রাখা হয়নি; Vercel API server-এ যাচাই হয়।
- Supabase Secret Key শুধু server-side environment variable-এ রাখুন।
- পরিবারের হিসাব সংবেদনশীল হলে পরবর্তীতে প্রত্যেক সদস্যের আলাদা login ও দীর্ঘ PIN/password ব্যবহার করুন।

## ফাইল কাঠামো

```text
nusrat-er-songshar-vercel/
├── index.html
├── api/
│   ├── auth.js
│   └── data.js
├── lib/
│   ├── merge.js
│   └── server.js
├── database.sql
├── package.json
├── vercel.json
├── .env.example
└── README-BN.md
```

`app.py` দরকার নেই; Vercel-এর Node.js serverless functions এই দুই API route চালায়।
