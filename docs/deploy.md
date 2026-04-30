# Deployment

Hosted on **Render** (Starter plan, single instance) with custom domain via **Namecheap**, all managed by Terraform.

The infrastructure-as-code lives in a separate **private** repo: `intinig/sync-paradise-infra`. That repo holds the Terraform module (Render Web Service, custom domain, Namecheap DNS records) and the deploy walkthrough including the unavoidable manual prerequisites (Google OAuth client creation, Namecheap API access toggle, Render API key).

This repo only ships the `Dockerfile` Render builds from. Pushes to `main` here trigger Render's auto-deploy.
