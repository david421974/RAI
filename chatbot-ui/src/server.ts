
import express from 'express';
import { join } from 'node:path';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { renderApplication } from '@angular/platform-server';

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();

// Servir archivos estáticos
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);
