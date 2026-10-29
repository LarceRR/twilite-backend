import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import type { AppConfig } from '@/config/env';

/**
 * OpenAPI is the contract the client is generated against, so the document is
 * always available (including in production) at `/v1/docs` and `/v1/docs-json`.
 */
export function setupSwagger(app: INestApplication, config: AppConfig): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Twilite API')
      .setDescription(
        [
          'API Twilite. Защищённые маршруты требуют bearer-токен.',
          'Write-запросы принимают и возвращают version для оптимистичных блокировок.',
        ].join(' '),
      )
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addServer(config.app.isProduction ? '/' : `http://localhost:${config.app.port}`)
      .build(),
  );

  SwaggerModule.setup('v1/docs', app, cleanupOpenApiDoc(document), {
    jsonDocumentUrl: 'v1/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}
