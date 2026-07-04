import 'reflect-metadata';
import Container from 'typedi';
import { TemplateService } from '../modules/templates/template.service';

(async () => {
  const templateService = Container.get(TemplateService);
  try {
    const result = await templateService.syncMetaTemplates();
    console.log('✅ Meta templates synced. Count:', result.length);
    console.dir(result, { depth: null });
    process.exit(0);
  } catch (err) {
    console.error('❌ Error syncing meta templates:', err);
    process.exit(1);
  }
})();
