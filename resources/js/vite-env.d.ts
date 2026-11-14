/// <reference types="vite/client" />

// Frontend config (file upload, agent invitation, OL, AI) is read from
// process.env.MIX_* (forwarded to both bundlers, see vite.config.mjs), not
// import.meta.env.VITE_* — no ImportMetaEnv keys are in use.
