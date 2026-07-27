'use client';
import { usePathname } from 'next/navigation';
import WordmarkGriotheque from './WordmarkGriotheque';
import { estGriotheque } from './ThemeSection';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useMediaQuery } from '@/components/ui';

// ── Logo LES GRIOTS (inline, hérite de currentColor → s'adapte encre/papier) ──
const Wordmark = ({ height = 22 }) => (
  <svg viewBox="0 0 620.66 159.56" height={height} fill="currentColor" role="img" aria-label="LES GRIOTS" style={{ display: 'block' }}>
    <path d="m620.65,86.02c-.66,1.97-1.13,4.04-2.04,5.9-1.8,3.68-4.62,6.54-7.91,8.95-5.27,3.86-11.26,5.86-17.62,6.97-4.27.74-8.56,1.19-12.88.92-6.1-.38-12.05-1.53-17.55-4.37-4.38-2.26-7.87-5.42-9.2-10.35-1.73-6.44.6-11.46,7.13-14.07,3.48-1.39,7.07-1.58,10.66-.61,1.17.31,2.3.99,3.26,1.74,1.17.92,1.46,2.92.77,4.24-2.45,4.75-1.59,9.09,1.59,13.14,3.15,4.03,7.34,5.87,12.4,5.47,2.54-.2,4.97-.95,6.67-3.16,1.53-1.99,1.58-4.16,1.04-6.44-.89-3.83-3.64-6.39-6.35-8.91-2.01-1.87-4.21-3.54-6.39-5.23-3.63-2.8-7.35-5.5-10.97-8.32-2.61-2.03-5.14-4.15-7.68-6.27-1.49-1.24-2.99-2.48-4.33-3.87-3.28-3.4-5.46-7.38-6.37-12.08-.69-3.54-.42-6.97.63-10.34,1.24-3.99,4.03-6.78,7.51-8.89,4.19-2.55,8.81-3.84,13.65-4.31,3.11-.3,6.26-.61,9.38-.45,6.83.34,13.58,1.27,19.93,4.1,3.54,1.58,6.72,3.59,8.87,6.93,1.9,2.96,2.64,6.12,1.23,9.48-.9,2.14-2.53,3.64-4.64,4.62-2.39,1.1-4.81,1.53-7.37.56-3.08-1.16-4.87-3.42-5.71-6.52-.63-2.31.03-4.49.54-6.72,1.01-4.36-1.22-6.68-5.43-7.5-2.18-.42-4.21-.06-6.23.68-3.01,1.09-4.99,3.14-5.39,6.36-.2,1.61.5,3.12,1.73,4.21,1.98,1.74,4,3.45,6.09,5.05,3.98,3.05,8.06,5.98,12.04,9.04,3.58,2.75,7.14,5.54,10.6,8.45,4.49,3.77,7.61,8.37,8.14,14.41,0,.09.14.16.21.24v6.95h-.01Z" />
    <path d="m37.23,0v77.61c0,3.68-.05,7.37,0,11.05.08,4.21.49,8.37,2.13,12.33,1.19,2.87,3.44,4.75,5.76,6.6.39.31.8.61,1.23.94-.11.1-.19.23-.26.23-4.13-.14-8.26-.21-12.38-.47-2.94-.18-5.89-.48-8.79-.97-4.62-.79-9.22-1.71-13.31-4.25-3.98-2.47-6.29-6.04-7.24-10.53-.3-1.41-.48-2.88-.48-4.33-.03-22.24.02-44.47-.07-66.71,0-2.77-.06-5.68-1.88-8.11-.65-.87-1.28-1.75-1.95-2.66C12.96,9.33,25.09,5.46,36.75,0h.48Z" />
    <path d="m543.64,0v25.63h9.54v2.61h-9.54v1.41c0,20.69-.07,41.37.05,62.05.02,4.23.76,8.51,3.57,11.94,1.37,1.68,3.22,2.98,4.86,4.45.14.13.34.19.52.29l-.14.33c-.32.03-.64.08-.95.08-3.22-.07-6.46-.02-9.67-.26-6.85-.52-13.69-1.22-20.21-3.58-6.44-2.33-10.45-6.76-11.37-13.69-.14-1.05-.23-2.12-.24-3.18-.01-17.29.04-34.59-.05-51.87-.02-4.42-2.07-7.9-6.04-10.1-.1-.05-.17-.15-.38-.34,1.72-.21,3.34-.32,4.92-.61,4.23-.77,8.48-1.49,12.66-2.46,3.32-.77,6.49-2.07,9.32-4.02,3.16-2.18,5.59-5.07,7.48-8.37,1.7-2.96,2.97-6.11,3.69-9.47.06-.27.03-.55.05-.83h1.93Z" />
    <path d="m404.51,0c1.44.52,2.98.89,4.32,1.6,3.57,1.9,5.77,4.9,6.47,8.91.98,5.57-.92,10.09-5.5,13.24-3.8,2.61-8.09,2.92-12.36,1.11-4.39-1.86-7.04-5.33-7.72-9.98-.69-4.74.87-8.96,4.94-12.23,1.76-1.44,3.88-2.05,6.01-2.65h3.84Z" />
    <path d="m237.88,91.06c-2.07-1.83-4.26-3.49-6.11-5.46-4.37-4.68-7.36-10.15-8.35-16.53-.43-2.76-.64-5.62-.46-8.4.33-5.02,1.95-9.7,4.48-14.08,1.97-3.41,4.48-6.35,7.36-9,3.5-3.23,7.48-5.78,11.85-7.57,3.41-1.4,7.02-2.37,10.6-3.28,2.12-.54,4.35-.71,6.54-.84,2.24-.14,4.51-.2,6.74,0,4.65.43,9.21,1.37,13.6,2.99,4.6,1.7,8.8,4.13,12.62,7.16,3.56,2.81,6.4,6.28,8.61,10.25,2.03,3.66,3.55,7.54,4.06,11.67.36,2.88.19,5.84.07,8.76-.19,4.43-1.75,8.48-3.82,12.34-2.08,3.88-4.96,7.08-8.32,9.9-3.96,3.32-8.41,5.76-13.26,7.41-2.69.91-5.51,1.43-8.28,2.08-3.86.92-7.81.85-11.73.68-2.85-.13-5.69-.67-8.54-1.03-2.18-.28-4.36-.61-6.55-.83-3.03-.29-6.06-.69-9.09-.67-2.43.02-4.97.06-7.12,1.6-.96.68-2.01,1.5-1.87,2.67.14,1.14,1.3,1.73,2.41,2.19,2.71,1.13,5.52,1.73,8.45,1.87,3.37.15,6.74.45,10.1.44,3.77,0,7.54-.24,11.3-.46,3.08-.18,6.15-.46,9.22-.71,3.82-.31,7.63-.66,11.45-.95,2.68-.2,5.39-.18,8.06-.52,4.59-.59,8.93.36,13.13,1.98,4.84,1.87,8.73,4.85,10.07,10.21.7,2.8.61,5.64.05,8.46-1.13,5.65-3.9,10.41-7.71,14.69-3.84,4.31-8.33,7.76-13.26,10.71-4.28,2.56-8.85,4.5-13.58,6.03-4.99,1.62-10.08,2.87-15.28,3.54-3.04.39-6.1.72-9.16.95-2.46.18-4.93.33-7.39.23-5.16-.22-10.28-.88-14.97-3.19-5.05-2.49-8.47-6.36-9.46-12.11-.6-3.47-.22-6.77,1.74-9.72,2.21-3.33,5.52-5.1,9.36-5.83,2.73-.51,5.47-.57,8.14.57,4.32,1.86,7,5.09,8.11,9.6.65,2.63.11,5.23-.35,7.84-.7,3.99.82,7.02,5.18,7.86,3.16.61,6.08-.36,8.97-1.29,4.91-1.59,9.2-4.3,13.09-7.68,3.85-3.35,7.13-7.15,9.29-11.78,1.19-2.55,1.21-4.06-.69-5.47-.88-.65-2.16-1.06-3.26-1.07-10.69-.08-21.38.08-32.07-.1-5.65-.09-11.33-.45-16.7-2.57-6.01-2.37-10.5-6.21-11.87-12.79-1.1-5.29,0-10.1,3.59-14.32,2.88-3.4,6.58-5.21,10.78-6.25.1-.03.18-.14.26-.2l-.03.02Zm17.18-29c-.1,5.36.31,10.29,1.4,15.18.88,3.95,1.96,7.81,4.35,11.16,1.93,2.71,5.73,4.35,9.14,1.86,2.19-1.61,3.34-3.87,4.26-6.23,2.48-6.37,3.14-13.09,3.38-19.85.06-1.66-.2-3.32-.21-4.98,0-4.03-.56-8.01-1.49-11.91-.92-3.87-1.95-7.7-4.45-10.99-2.85-3.76-7.68-3.83-10.62.07-2.16,2.87-3.22,6.26-4.04,9.67-1.28,5.37-1.96,10.85-1.73,16.03h0Z" />
    <path d="m75.5,72.6c1.08,2.33,1.98,4.57,3.12,6.68,1.55,2.87,3.62,5.36,6.06,7.53,3.19,2.84,6.81,4.81,11.11,5.47,5.57.85,10.66-.32,15.2-3.6,3.51-2.54,6.51-5.62,8.58-9.49.37-.69.79-1.35,1.15-2.05.39-.77,1.07-.82,1.72-.6.17.06.25.77.18,1.15-1.04,5.88-3.3,11.23-7.14,15.86-3.97,4.79-8.63,8.7-14.36,11.24-3.73,1.66-7.55,3.06-11.63,3.51-2.79.31-5.62.57-8.42.46-7.39-.28-14.57-1.71-21.23-5.02-1.94-.97-3.72-2.35-5.38-3.76-4.17-3.53-7.36-7.82-9.59-12.83-1.58-3.55-2.9-7.18-3.32-11.06-.32-2.94-.74-5.9-.67-8.84.12-5.28,1.22-10.4,3.3-15.29,1.59-3.74,3.57-7.24,6.09-10.41,2.82-3.55,6.25-6.46,10.15-8.77,5.25-3.11,11-4.84,16.96-5.91,2.63-.47,5.3-.7,7.96-.97,6.52-.68,12.9,0,19.09,2.16,3.94,1.38,7.58,3.35,10.4,6.49,3.02,3.36,4.74,7.26,4.96,11.89.26,5.43-1.46,10.12-4.67,14.35-2.12,2.8-4.87,4.91-7.87,6.7-4.47,2.66-9.37,4.15-14.47,4.84-2.71.36-5.48.25-8.22.29-2.92.04-5.84,0-9.06,0v-.02Zm-1.06-3.74c3.46,1.07,6.65,1.38,9.96.89,5.48-.8,9.3-3.93,11.8-8.62,3.22-6.05,3.98-12.59,3.18-19.36-.47-3.98-2.58-7.03-5.42-9.63-1.11-1.02-2.55-1.68-4.1-1.43-2.08.34-3.92,1.31-5.46,2.79-2.81,2.71-4.84,5.92-6.45,9.47-2.18,4.8-3.4,9.84-3.72,15.05-.22,3.62.12,7.27.21,10.84Z" />
    <path d="m423.59,68.07c-.13-7.12,1.7-13.76,4.9-20.05,1.64-3.23,3.73-6.16,6.2-8.84,3.7-4.01,8-7.17,12.9-9.51,3.91-1.87,8.02-3.08,12.34-3.55,1.8-.2,3.63-.56,5.42-.44,5.06.35,10,1.3,14.72,3.29,4.02,1.7,7.59,4.05,10.88,6.89,6.14,5.3,9.94,11.99,12.22,19.71,1.51,5.13,1.88,10.33,1.58,15.58-.28,4.86-1.56,9.53-3.48,14.04-2.17,5.1-5.34,9.46-9.43,13.13-3.22,2.89-6.84,5.19-10.85,6.92-3.96,1.71-8.09,2.66-12.32,3.27-3.46.5-6.9.13-10.37-.38-4.34-.65-8.53-1.8-12.39-3.79-2.98-1.53-5.8-3.44-8.45-5.5-4.29-3.34-7.45-7.66-9.77-12.56-1.97-4.16-3.37-8.5-3.75-13.12-.14-1.7-.24-3.4-.35-5.1h0Zm27.25-1.01c.31,3.74.59,7.48.93,11.22.37,4.18,1.26,8.26,2.65,12.23,1.19,3.42,2.53,6.74,5.53,9.08,2.74,2.13,6.73,1.92,9.28-.44,2.27-2.1,3.59-4.75,4.61-7.57,2.54-7.02,3.35-14.35,3.55-21.74.1-3.52-.15-7.06-.47-10.56-.3-3.27-.74-6.55-1.45-9.76-.98-4.42-2.27-8.74-4.94-12.55-3.36-4.79-9.5-4.82-12.8,0-1.93,2.82-3.13,5.93-4.05,9.18-1.92,6.83-2.59,13.82-2.84,20.9h0Z" />
    <path d="m151.43,108.95c-6.05-.11-11.93-1.09-17.53-3.32-4.43-1.77-8.3-4.4-10.71-8.68-.96-1.71-1.35-3.61-1.59-5.6-.33-2.79.36-5.23,2.02-7.35,2.15-2.73,5.09-4.32,8.5-4.89,2.98-.5,5.94-.51,8.85.63,2.92,1.14,4.07,3.35,2.72,6.11-2.87,5.87-.02,11.68,4.28,15.12,2.88,2.3,6.16,3.28,9.79,3.02,2.7-.2,5.23-1.01,6.89-3.31,1.75-2.42,1.52-5.14.48-7.75-1.14-2.87-3.18-5.1-5.56-7.04-1.77-1.45-3.43-3.04-5.22-4.45-3.08-2.43-6.25-4.75-9.35-7.15-2.92-2.26-5.85-4.51-8.69-6.86-2.28-1.89-4.53-3.85-6.64-5.92-3.43-3.37-5.43-7.57-6.28-12.25-.7-3.86-.35-7.74,1.28-11.32,2.03-4.49,5.8-7.28,10.23-9.15,4.1-1.73,8.42-2.58,12.88-2.96,3.86-.32,7.66-.08,11.5.25,4.84.42,9.53,1.42,14.04,3.17,3.81,1.48,7.39,3.45,9.8,6.88,2.35,3.36,3.34,7.04,1.13,10.87-1.53,2.65-3.93,4.33-6.99,4.72-5.34.67-9.08-1.87-10.27-7.16-.37-1.61.08-3.42.24-5.13.07-.81.4-1.59.51-2.4.56-3.89-2.64-5.89-5.51-6.38-3.49-.59-6.67.15-9.35,2.42-2.5,2.12-3.61,5.97-.65,8.75,2.38,2.23,4.93,4.3,7.52,6.29,5.32,4.08,10.77,7.99,16.06,12.1,2.62,2.03,5.09,4.26,7.51,6.53,3.47,3.25,5.18,7.39,5.78,12.05.46,3.6.49,7.17-.76,10.63-1.47,4.09-4.04,7.38-7.39,10.16-3.9,3.24-8.26,5.55-13.13,6.83-3.09.81-6.26,1.36-9.43,1.87-2.3.36-4.64.45-6.96.67h0Z" />
    <path d="m355.99,108.55c-2.74,0-5.43.02-8.12,0-4.71-.03-9.33-.8-13.86-1.96-4.38-1.12-8.55-2.82-12.25-5.48-3.51-2.52-6.41-5.55-7.47-9.93-.21-.87-.44-1.76-.44-2.65-.03-12.54.04-25.08-.05-37.62-.03-3.84-.55-7.67-2.38-11.17-.56-1.07-1.24-2.07-1.9-3.18,12.8-2.45,25.17-6.28,37.43-10.89v14.55c1.12-1.97,2-3.8,3.14-5.46,2.69-3.9,5.97-7.09,10.69-8.5,4.87-1.46,9.23-.57,12.86,2.95,2.44,2.37,3.77,5.39,4.3,8.82.57,3.68-.25,6.94-2.45,9.86-1.87,2.49-4.42,3.96-7.47,4.57-2.17.43-4.29.3-6.38-.46-2.65-.95-4.48-2.86-6.04-5.08-.81-1.15-1.48-2.4-2.29-3.55-.6-.85-1.13-2.02-2.37-1.9-1.33.13-2.04,1.29-2.51,2.39-1,2.32-1.48,4.78-1.48,7.32v35.58c0,3.71.25,7.4,1.1,11.03,1.05,4.51,3.78,7.77,7.56,10.27.13.09.26.18.36.29.04.05.03.15.03.18v.02Z" />
    <path d="m428.17,108.57c-2.75,0-5.27.03-7.79-.01-1.46-.02-2.93-.11-4.39-.26-7.64-.75-15.01-2.4-21.52-6.72-3.71-2.46-6.79-5.53-8.02-10-.36-1.31-.62-2.69-.63-4.04-.05-12.18-.04-24.35-.02-36.53.01-5.23-1-10.13-4.3-14.48,12.83-2.43,25.15-6.24,37.4-10.84v1.4c0,20.48-.06,40.96.05,61.44.02,4.69.44,9.41,2.79,13.7,1.18,2.15,2.96,3.66,4.83,5.12.49.38.98.75,1.6,1.22h0Z" />
    <path d="m444.83,152.39c-2,0-4-.08-6,.02-4.43.21-8.89-3.36-9.84-7.89-.15-.73-.24-1.48-.24-2.22-.02-3.99-.01-7.99-.01-11.98,0-4.79,3.87-9.38,8.67-9.74,4.6-.35,9.25-.47,13.86-.23,5.56.3,9.78,4.95,9.64,10.65-.1,3.83-.02,7.67-.02,11.5,0,5.29-4.77,10.05-9.94,9.9-2.04-.06-4.08,0-6.12,0h0Z" />
    <path d="m407.1,152.39c-2.08,0-4.16-.05-6.24,0-4.23.13-8.94-3.62-9.55-8.05-.1-.74-.22-1.48-.23-2.22-.02-4.03-.01-8.07-.01-12.1,0-4.49,4.08-9.18,8.59-9.46,4.61-.29,9.26-.49,13.86-.21,5.72.34,9.68,4.81,9.7,10.45v11.38c-.01,4.97-3.54,9.34-8.46,10.12-2.5.39-5.11.07-7.67.07h.01Z" />
    <path d="m482.43,152.39c-1.88,0-3.76-.1-5.64.02-4.77.3-9.05-3.31-10.13-7.97-.18-.76-.25-1.56-.25-2.34-.03-3.71.05-7.43-.03-11.14-.11-5.06,3.64-9.9,8.78-10.42,2.17-.22,4.36-.21,6.54-.25,2.16-.04,4.32-.01,6.48,0,5.98.02,10.5,5.05,10.38,10.31-.09,4.03-.05,8.07-.01,12.1.04,5-4.71,9.78-9.76,9.7-2.12-.03-4.24,0-6.36,0h0Z" />
  </svg>
);

// ── Icons (inline SVG for zero dependencies) ──
const icons = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  pipeline: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  clients: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  providers: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  projects: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  organisme: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16"/><path d="M6 18V9a6 6 0 1 1 12 0v9"/><circle cx="12" cy="9" r="2"/></svg>,
  formations: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  sessions: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  apprenants: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  team: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  finances: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg>,
  pricing: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  collapse: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>,
  expand: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>,
};

// Menu réagencé (grille Chris Do) : la Griothèque — moteur cash — passe en premier.
const NAV = [
  { type: 'item', href: '/', icon: 'home', label: 'Accueil', monde: 'studio' },
  // Sur le domaine Griothèque, l'accueil est la vue d'ensemble de l'OF.
  { type: 'item', href: '/apercu', icon: 'home', label: 'Vue d’ensemble', monde: 'griotheque' },

  // ── Monde Griothèque : le découpage de l'ancienne interface, conservé ──
  { type: 'divider', label: 'COMMERCIAL', monde: 'griotheque' },
  { href: '/pipeline-formations', icon: 'pipeline', label: 'Pipeline', monde: 'griotheque', compteur: 'pipeline' },
  { type: 'divider', label: 'CATALOGUE', monde: 'griotheque' },
  { href: '/catalogue', icon: 'formations', label: 'Formations', monde: 'griotheque' },
  { href: '/sessions-list', icon: 'sessions', label: 'Sessions', monde: 'griotheque', compteur: 'sessions' },
  // Tout ce qui est répertoire tient en un seul endroit : DATA.
  { type: 'divider', label: 'DATA', monde: 'griotheque' },
  { href: '/apprenants', icon: 'apprenants', label: 'Apprenants', monde: 'griotheque', compteur: 'apprenants' },
  { href: '/entreprises', icon: 'clients', label: 'Entreprises', monde: 'griotheque' },
  { href: '/clients', icon: 'clients', label: 'Clients', monde: 'griotheque' },
  { href: '/financeurs', icon: 'finances', label: 'Financeurs', monde: 'griotheque' },
  { href: '/lieux', icon: 'projects', label: 'Lieux', monde: 'griotheque' },
  { type: 'divider', label: 'QUALITÉ', monde: 'griotheque' },
  { href: '/intervenants', icon: 'team', label: 'Intervenants', monde: 'griotheque' },
  { href: '/qualite', icon: 'settings', label: 'Qualité', monde: 'griotheque' },
  { href: '/organisme', icon: 'organisme', label: 'Organisme', monde: 'griotheque', compteur: 'conformite', ton: 'alerte' },

  // ── Monde Studio : inchangé ──
  { type: 'divider', label: 'GRIOTHÈQUE', monde: 'studio' },
  { href: '/formations', icon: 'formations', label: 'Formations', monde: 'studio' },
  { type: 'divider', label: 'STUDIO', monde: 'studio' },
  { href: '/projects', icon: 'projects', label: 'Projets', monde: 'studio' },
  { href: '/pipeline', icon: 'pipeline', label: 'Pipeline', monde: 'studio' },
  { type: 'divider', label: 'ARGENT', monde: 'studio' },
  { href: '/finances', icon: 'finances', label: 'Finances', monde: 'studio' },
  { href: '/pricing', icon: 'pricing', label: 'TJM', monde: 'studio' },

  { type: 'divider', label: 'RÉPERTOIRE', monde: 'studio' },
  { href: '/clients', icon: 'clients', label: 'Clients', monde: 'studio' },
  { href: '/providers', icon: 'providers', label: 'Prestataires', monde: 'studio' },
  { href: '/team', icon: 'team', label: 'Équipe', monde: 'studio' },
  { type: 'spacer' },
  { href: '/parametres-formation', icon: 'settings', label: 'Paramètres', monde: 'griotheque' },
  { href: '/settings', icon: 'settings', label: 'Réglages' },
];

// Deux libellés d'identité : l'initiale quand la place manque, le rôle en clair.
const initiales = (nom) => (nom || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('') || '—';

const ROLES = {
  admin: 'Administrateur',
  formateur: 'Formateur',
  gestionnaire: 'Responsable pédagogique',
  lecteur: 'Lecture seule',
};
const roleLisible = (r) => ROLES[r] || 'Responsable pédagogique';

export default function Sidebar() {
  const pathname = usePathname();
  // Deux mondes : la Griothèque porte sa propre marque, le Studio la sienne.
  const monde = estGriotheque(pathname || '') ? 'griotheque' : 'studio';
  const [compteurs, setCompteurs] = useState({});
  const [moi, setMoi] = useState(null);
  const [collapsedState, setCollapsed] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = collapsedState && !isMobile;

  // Les pastilles et l'identité ne concernent que l'organisme de formation.
  useEffect(() => {
    if (monde !== 'griotheque') return;
    let vivant = true;
    Promise.all([
      fetch('/api/griotheque/compteurs').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([c, m]) => { if (vivant) { setCompteurs(c || {}); setMoi(m); } });
    return () => { vivant = false; };
  }, [monde]);

  const w = collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';

  const asideStyle = isMobile
    ? {
        width: 'var(--sidebar-width)',
        minWidth: 'var(--sidebar-width)',
        height: '100dvh',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 900,
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 200ms ease',
        boxShadow: mobileOpen ? 'var(--shadow-lg)' : 'none',
      }
    : {
        width: w,
        minWidth: w,
        height: '100vh',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: `width var(--duration) var(--ease), min-width var(--duration) var(--ease)`,
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      };

  return (
    <>
    <button
      className="resp-hamburger btn-inline"
      onClick={() => setMobileOpen(o => !o)}
      aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 950,
        width: 40,
        height: 40,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {mobileOpen ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      )}
    </button>

    {isMobile && mobileOpen && (
      <div
        onClick={() => setMobileOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 890 }}
      />
    )}

    <aside className={mobileOpen ? 'os-sidebar os-sidebar-open' : 'os-sidebar'} style={asideStyle}>
      {/* Brand */}
      <div style={{
        padding: collapsed ? '20px 0' : '18px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: collapsed ? 'center' : 'stretch',
        justifyContent: 'center',
        gap: 8,
        borderBottom: '1px solid var(--border)',
        minHeight: 64,
      }}>
        {!collapsed && (
          <>
            {monde === 'griotheque' ? (
              // Monde Griothèque : le mot-marque du site, encré sur le papier.
              <div style={{ padding: '4px 0 2px' }}>
                <WordmarkGriotheque height={17} style={{ maxWidth: '100%' }} />
              </div>
            ) : (
              <img src="/branding/lesgriots-sticker.png" alt="les griots" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 10, filter: 'drop-shadow(2px 3px 0 rgba(0,0,0,0.30))' }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.28em', fontWeight: 700, paddingLeft: 3 }}>
                {monde === 'griotheque' ? 'ORGANISME DE FORMATION' : 'OS'}
              </div>
              <button
                className="resp-hide-mobile btn-inline"
                onClick={() => setCollapsed(!collapsed)}
                style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}
                title="Collapse"
              >
                {icons.collapse}
              </button>
            </div>
          </>
        )}
        {collapsed && (
          <div style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: '#F2CE1B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
          }} aria-label={monde === 'griotheque' ? 'la griothèque' : 'les griots'}>
            {monde === 'griotheque' ? (
              // Replié : le mot-marque ne tient pas, on garde l'initiale de la maison.
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, color: '#141210', lineHeight: 1 }}>G</span>
            ) : (
              <>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#141210', display: 'block' }} />
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#141210', display: 'block' }} />
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#141210', display: 'block' }} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{
        flex: 1,
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        overflowY: 'auto',
      }}>
        {NAV.map((item, i) => {
          if (item.type === 'divider') {
            return (
              <div key={i} className={item.monde ? 'nav-monde-' + item.monde : undefined} style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-3)',
                letterSpacing: '0.1em',
                padding: collapsed ? '16px 0 6px' : '16px 12px 6px',
                textAlign: collapsed ? 'center' : 'left',
              }}>
                {collapsed ? '·' : item.label}
              </div>
            );
          }

          if (item.type === 'spacer') {
            return <div key={i} style={{ flex: 1 }} />;
          }

          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
            className={item.monde ? 'nav-monde-' + item.monde : undefined}
            onClick={() => { if (isMobile) setMobileOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '9px 0' : '9px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 'var(--radius-md)',
              color: isActive ? 'var(--gold)' : 'var(--text-2)',
              background: isActive ? 'var(--gold-soft)' : 'transparent',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              transition: `all var(--duration) var(--ease)`,
              position: 'relative',
            }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)'; }}}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: collapsed ? '50%' : 0,
                  transform: collapsed ? 'translateX(-50%)' : 'none',
                  top: collapsed ? 'auto' : 6,
                  bottom: collapsed ? -4 : 6,
                  width: collapsed ? 16 : 3,
                  height: collapsed ? 3 : 'auto',
                  borderRadius: 2,
                  background: 'var(--gold)',
                }} />
              )}
              <span style={{ flexShrink: 0 }}>{icons[item.icon]}</span>
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.compteur && compteurs[item.compteur] ? (
                <span style={{
                  marginLeft: 'auto',
                  minWidth: 20,
                  padding: '1px 6px',
                  borderRadius: 20,
                  fontSize: 10.5,
                  fontWeight: 600,
                  lineHeight: 1.6,
                  textAlign: 'center',
                  background: item.ton === 'alerte' ? 'var(--gold)' : 'rgba(255,255,255,0.10)',
                  color: item.ton === 'alerte' ? '#141210' : 'var(--text-2)',
                }}>
                  {compteurs[item.compteur]}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {monde === 'griotheque' && !collapsed && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'var(--gold)', color: '#141210',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em',
            }}>
              {initiales(moi?.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {moi?.name || 'Compte'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {roleLisible(moi?.role)}
              </div>
            </div>
          </div>
          <Link href="/" style={{ fontSize: 11, color: 'var(--text-3)', textDecoration: 'none' }}
                title="Projets, pipeline agence, finances globales">
            <span style={{ opacity: 0.7 }}>&#8599;</span> LES GRIOTS OS
          </Link>
        </div>
      )}

      {collapsed && (
        <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setCollapsed(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 6, borderRadius: 4, display: 'flex' }}
          >
            {icons.expand}
          </button>
        </div>
      )}
    </aside>
    </>
  );
}
