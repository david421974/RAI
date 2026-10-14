// @ts-expect-error - The Playwright dependency must be installed in the project.
import { test, expect, type Route } from '@playwright/test';

test.describe('Flujo E2E - Chatbot RAI', () => {

  test('Debería iniciar sesión correctamente y enviar un mensaje al bot', async ({ page }: { page: Page }) => {
  
  // Cada vez que Angular intente llamar a localhost:7001, Playwright 
  // lo redirigirá internamente al puente de Docker de forma transparente.
  await page.route('**/localhost:7001/**', (route: Route) => {
    const urlOriginal = route.request().url();
    const urlModificada = urlOriginal.replace('localhost:7001', 'host.docker.internal:7001');
    route.continue({ url: urlModificada });
  });

    // 1. Navegar a la página de login
    await page.goto('/');

    // 2. Rellenar el formulario de inicio de sesión
    // Nota: Ajusta los selectores ('input[type=...]') si tu HTML usa selectores específicos (como id="email" o formControlName)
    await page.locator('input[type="email"]').fill('trinidad.diezrojo@capgemini.com');
    await page.locator('input[type="password"]').fill('trinity'); 
    
    // 3. Hacer clic en el botón de ingresar
    //await page.locator('button:has-text("Entrar al chatbot")').click();
    await page.getByRole('button', { name: 'Entrar al chatbot' }).click();

    // 4. Verificar que el login fue exitoso comprobando que cambió la URL o que el formulario desapareció
    await expect(page).not.toHaveURL(/.*auth/);
    
    // 5. Interactuar con el Chatbot
    // Buscamos la caja de texto donde se escriben los mensajes en el chat
    const chatInput = page.locator('textarea, input[placeholder*="Escribe"], input[placeholder*="mensaje"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 }); // Espera hasta 10s a que cargue la interfaz del chat
    
    // Escribimos un saludo de prueba
    await chatInput.fill('Hola');
    await chatInput.press('Enter');

    // 6. Verificar que el bot responde y no ignora el mensaje
    // Buscamos en la pantalla el contenedor de respuestas que NO contenga el texto de error del agente
    const botResponse = page.locator('.message, .bot-message, div:has-text("Hola")');
    await expect(botResponse.last()).toBeVisible();
    
    // Verificación de seguridad: Aseguramos que la interfaz no muestre el error de Rasa en la pantalla
    const agentError = page.locator('text=Ignoring message as there is no agent to handle it');
    await expect(agentError).not.toBeVisible();
  });

});