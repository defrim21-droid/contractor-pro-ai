# Vertex AI Imagen Setup Guide

Use this guide to enable Vertex AI Imagen for masked edits in ContractorPro AI.

---

## What You Need to Provide

After completing the steps below, you will have:

1. **Project ID** – e.g. `my-project-123`
2. **Service account JSON** – a JSON file with your credentials
3. **Region** – e.g. `us-central1` (optional, this is the default)

---

## Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Name it (e.g. "ContractorPro AI") and click **Create**
4. Copy the **Project ID** from the dashboard (you will need this)

---

## Step 2: Enable Billing

1. Go to **Billing** in the left menu
2. Link a billing account (Vertex AI requires billing to be enabled)
3. Add a payment method if prompted

---

## Step 3: Enable the Vertex AI API

1. Go to **APIs & Services** → **Library**
2. Search for **Vertex AI API**
3. Click **Enable**

---

## Step 4: Create a Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Name it (e.g. `contractor-pro-imagen`)
4. Click **Create and Continue**
5. Under **Grant this service account access**, add the role:
   - **Vertex AI User** (or **Vertex AI Administrator**)
6. Click **Done**

---

## Step 5: Create and Download the JSON Key

1. Click on the service account you just created
2. Open the **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** and click **Create**
5. A JSON file will download – **keep this file secure**

---

## Step 6: Add Credentials to Railway

Add these variables in your Railway project:

| Variable | Value | Notes |
|----------|-------|-------|
| `VERTEX_IMAGEN_ENABLED` | `true` | Turns on Vertex for masked edits |
| `GOOGLE_CLOUD_PROJECT` | `your-project-id` | Your GCP Project ID from Step 1 |
| `GOOGLE_CREDENTIALS_JSON` | *(full JSON content)* | Paste the entire JSON from the downloaded file |
| `VERTEX_LOCATION` | `us-central1` | Optional; default is us-central1 |

### How to paste the JSON in Railway

1. Open the downloaded JSON file in a text editor
2. Select all and copy
3. In Railway → Variables, add `GOOGLE_CREDENTIALS_JSON`
4. Paste the entire JSON as the value (it can be a single line)

---

## Supported Regions

Imagen 3 is available in these regions, among others:

- `us-central1`
- `us-east5`
- `europe-west1`
- `asia-southeast1`

Check [Vertex AI locations](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations) for the latest list.

---

## Verify Setup

1. Redeploy the worker after adding the variables
2. Run a masked edit (upload photo, add reference, paint mask, generate)
3. Check the worker logs for: `[processJob] masked edit via Vertex Imagen`

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Failed to obtain Google Cloud access token" | Check that `GOOGLE_CREDENTIALS_JSON` is valid JSON and the service account has **Vertex AI User** role |
| "Project not found" | Verify `GOOGLE_CLOUD_PROJECT` matches your GCP project ID |
| "Permission denied" | Enable the Vertex AI API and ensure billing is enabled |
