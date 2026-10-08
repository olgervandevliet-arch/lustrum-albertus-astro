import { sanityClient } from 'sanity:client';
import { defineQuery } from 'groq';

const SITE_SETTINGS_QUERY = defineQuery(`*[_id == "siteSettings"][0]`);
const HOME_PAGE_QUERY = defineQuery(`*[_id == "homePage"][0]{
  countdownTargetDate,
  videos[]{ available, comingSoon, title, embed, thumbnail }
}`);
const PAKKETTEN_PAGE_QUERY = defineQuery(`*[_id == "pakkettenPage"][0]`);
const PARTNERS_PAGE_QUERY = defineQuery(`*[_id == "partnersPage"][0]{
  eyebrow, title, description,
  partners[]{ name, desc, src, url }
}`);
const FAQ_PAGE_QUERY = defineQuery(`*[_id == "faqPage"][0]`);
const CONTACT_PAGE_QUERY = defineQuery(`*[_id == "contactPage"][0]{
  eyebrow, title, description,
  emailContacts[]{ label, contactName, email },
  board[]{ name, role, email, photo, "photoDims": photo.asset->metadata.dimensions }
}`);
const KLEUREN_PAGE_QUERY = defineQuery(`*[_id == "kleurenPage"][0]`);
const THEMA_PAGE_QUERY = defineQuery(`*[_id == "themaPage"][0]`);
const TERREIN_PAGE_QUERY = defineQuery(`*[_id == "terreinPage"][0]`);
const PROGRAMMA_PAGE_QUERY = defineQuery(`*[_id == "programmaPage"][0]`);

export const getSiteSettings = () => sanityClient.fetch(SITE_SETTINGS_QUERY);
export const getHomePage = () => sanityClient.fetch(HOME_PAGE_QUERY);
export const getPakkettenPage = () => sanityClient.fetch(PAKKETTEN_PAGE_QUERY);
export const getPartnersPage = () => sanityClient.fetch(PARTNERS_PAGE_QUERY);
export const getFaqPage = () => sanityClient.fetch(FAQ_PAGE_QUERY);
export const getContactPage = () => sanityClient.fetch(CONTACT_PAGE_QUERY);
export const getKleurenPage = () => sanityClient.fetch(KLEUREN_PAGE_QUERY);
export const getThemaPage = () => sanityClient.fetch(THEMA_PAGE_QUERY);
export const getTerreinPage = () => sanityClient.fetch(TERREIN_PAGE_QUERY);
export const getProgrammaPage = () => sanityClient.fetch(PROGRAMMA_PAGE_QUERY);
