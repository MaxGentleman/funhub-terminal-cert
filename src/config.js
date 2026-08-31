/* Everything the browser is allowed to know. There is no database key here on
   purpose: the store codes are shared between people, so the browser is not a
   place a key can live. Every read and write goes through an Edge Function. */

const url = import.meta.env.VITE_SUPABASE_URL || "";
export const API = url.replace(/\/+$/, "") + "/functions/v1";

export const FOLDER = "https://drive.google.com/drive/folders/";

/* Store names are presentation, not data — the register keys on the code. */
export const STORES = [
  { code: "03", name: "Trois-Rivières",         drive: "1tu8CP5UwJAn7hrVnsqlr2J4ke3zP9fGT" },
  { code: "07", name: "DIX30",                  drive: "1DZRufR3a8BZRQvQl0uD8A36cralaTBCy" },
  { code: "11", name: "Cathcart",               drive: "1KY_qMw2Yn2r4rnNDqv-vFcrSoKkfVbwW" },
  { code: "HO", name: "Head Office / Unattended", drive: "1hmsLxx8pRu_1hC6rnR1A4352elxfCOAR" },
];

export const ROOT_DRIVE = "1_4g4lK8nE5vM99-eJA6mImQV2SrpZJwW";
