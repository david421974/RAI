import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';

const serverConfig = mergeApplicationConfig(appConfig, {
  providers: [
    provideServerRendering(),
  ],
});

const bootstrap = () => bootstrapApplication(AppComponent, serverConfig);
export default bootstrap;
