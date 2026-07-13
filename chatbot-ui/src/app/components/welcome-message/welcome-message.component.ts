import { Component } from '@angular/core';

@Component({
  selector: 'app-welcome-message',
  standalone: true,
  templateUrl: './welcome-message.component.html',
  styleUrl: './welcome-message.component.css',
})
export class WelcomeMessageComponent {
  readonly title = '¡HOLA! Soy RAI';
  readonly description =
    'Soy un asistente virtual de Capgemini. Estoy aquí para ayudarte con tus consultas sobre nóminas, registro de horas, solicitudes y mucho más. ¡Pregúntame lo que necesites!';
  readonly infoMessage =
    'Estoy aprendiendo, puedes consultar aquí lo que puedo responder';
}
