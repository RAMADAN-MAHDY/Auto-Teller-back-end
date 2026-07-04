import Container, { Service } from 'typedi';
import { FilterQuery } from 'mongoose';
import { TemplateRepository } from './template.repository';
import { CreateTemplateDto, UpdateTemplateDto, TemplateQueryDto, TemplateResponseDto } from './template.dto';
import { ConflictException, NotFoundException } from '../../common/exceptions';
import { IPaginatedResult } from '../../common/interfaces';
import { ITemplate } from './template.model';
import { extractVariables } from '../../common/utils/template-engine';
import { logger } from '../../logger';
import { WhatsAppProvider } from '../../providers/whatsapp.provider';

function mapMetaVariables(bodyText: string): string[] {
  const regex = /\{\{(\d+)\}\}/g;
  const matches: number[] = [];
  let match;
  while ((match = regex.exec(bodyText)) !== null) {
    const num = parseInt(match[1], 10);
    if (!matches.includes(num)) {
      matches.push(num);
    }
  }

  matches.sort((a, b) => a - b);

  return matches.map((index) => {
    const placeholderStr = `{{${index}}}`;
    const pos = bodyText.indexOf(placeholderStr);
    if (pos === -1) return 'customer';

    const before = bodyText.substring(Math.max(0, pos - 20), pos);
    const after = bodyText.substring(pos + placeholderStr.length, pos + placeholderStr.length + 20);

    const context = (before + ' ' + after).toLowerCase();

    if (context.includes('عميل') || context.includes('السيد') || context.includes('الاسم') || context.includes('أهلاً') || context.includes('مرحباً') || context.includes('اسم')) {
      return 'customer';
    }
    if (context.includes('شهر') || context.includes('تاريخ') || context.includes('استحقاق') || context.includes('موعد')) {
      return 'month';
    }
    if (context.includes('تأخر') || context.includes('يوم') || context.includes('أيام') || context.includes('تاخر')) {
      return 'day';
    }

    if (index === 1) return 'customer';
    if (index === 2) return 'month';
    if (index === 3) return 'day';
    return `var_${index}`;
  });
}

@Service()
export class TemplateService {
  private readonly templateRepository = Container.get(TemplateRepository);
  private readonly whatsAppProvider = Container.get(WhatsAppProvider);

  async create(dto: CreateTemplateDto, userId: string): Promise<TemplateResponseDto> {
    const existing = await this.templateRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException('A template with this name already exists');
    }

    const variables = extractVariables(dto.body);

    const template = await this.templateRepository.create({
      ...dto,
      variables,
      createdBy: userId,
    } as any);

    logger.info(`Template created: ${template.name} by User: ${userId}`);
    return this.toResponseDto(template);
  }

  async findAll(query: TemplateQueryDto): Promise<IPaginatedResult<TemplateResponseDto>> {
    const filter: FilterQuery<ITemplate> = {
      isMeta: { $ne: true }
    };

    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    const result = await this.templateRepository.findPaginated(filter, {
      page: query.page,
      limit: query.limit,
      sort: query.sort,
      order: query.order,
    }, { path: 'createdBy', select: 'fullName email' });

    return {
      data: result.data.map(this.toResponseDto),
      meta: result.meta,
    };
  }

  async findById(id: string): Promise<TemplateResponseDto> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    // Populate createdBy
    await template.populate('createdBy', 'fullName email');
    return this.toResponseDto(template);
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<TemplateResponseDto> {
    if (dto.name) {
      const existing = await this.templateRepository.findByName(dto.name);
      if (existing && existing.id !== id) {
        throw new ConflictException('A template with this name already exists');
      }
    }

    const updateData: Partial<ITemplate> & { variables?: string[] } = { ...dto };
    if (dto.body) {
      updateData.variables = extractVariables(dto.body);
    }

    const template = await this.templateRepository.updateById(id, updateData);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await template.populate('createdBy', 'fullName email');
    logger.info(`Template updated: ${template.name}`);
    return this.toResponseDto(template);
  }

  async delete(id: string): Promise<void> {
    const template = await this.templateRepository.deleteById(id);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    logger.info(`Template deleted: ${template.name}`);
  }

  private toResponseDto(template: ITemplate): TemplateResponseDto {
    const creator = template.createdBy as any;
    return {
      id: template.id,
      name: template.name,
      body: template.body,
      variables: template.variables,
      isMeta: template.isMeta,
      createdBy: creator && typeof creator === 'object' && creator.fullName
        ? { id: creator.id || creator._id?.toString(), fullName: creator.fullName }
        : template.createdBy?.toString(),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  async syncMetaTemplates(userId?: string): Promise<TemplateResponseDto[]> {
    const metaTemplates = await this.whatsAppProvider.getMetaTemplates();
    const approvedTemplates = metaTemplates.filter((t: any) => t.status === 'APPROVED');
    const syncedTemplates: ITemplate[] = [];

    // Fallback ID if no userId is provided (e.g., from system hook)
    const fallbackUserId = userId || '60c72b2f9b1d8e001c888888';

    for (const mt of approvedTemplates) {
      const bodyComponent = mt.components?.find((c: any) => c.type === 'BODY');
      const body = bodyComponent?.text || '';
      if (!body) continue;

      const variables = mapMetaVariables(body);

      let template = await this.templateRepository.findOne({ name: mt.name, isMeta: true });
      if (template) {
        template.body = body;
        template.variables = variables;
        await template.save();
      } else {
        template = await this.templateRepository.create({
          name: mt.name,
          body,
          variables,
          isMeta: true,
          createdBy: fallbackUserId,
        } as any);
      }
      syncedTemplates.push(template);
    }

    return syncedTemplates.map(t => this.toResponseDto(t));
  }

  async syncSingleMetaTemplate(metaTemplateId: string): Promise<TemplateResponseDto | null> {
    try {
      const mt = await this.whatsAppProvider.getMetaTemplateById(metaTemplateId);
      if (!mt || mt.status !== 'APPROVED') {
        if (mt && (mt.status === 'REJECTED' || mt.status === 'DELETED')) {
          await this.templateRepository.findOneAndDelete({ name: mt.name, isMeta: true });
        }
        return null;
      }

      const bodyComponent = mt.components?.find((c: any) => c.type === 'BODY');
      const body = bodyComponent?.text || '';
      if (!body) return null;

      const variables = mapMetaVariables(body);
      const fallbackUserId = '60c72b2f9b1d8e001c888888';

      let template = await this.templateRepository.findOne({ name: mt.name, isMeta: true });
      if (template) {
        template.body = body;
        template.variables = variables;
        await template.save();
      } else {
        template = await this.templateRepository.create({
          name: mt.name,
          body,
          variables,
          isMeta: true,
          createdBy: fallbackUserId,
        } as any);
      }
      return this.toResponseDto(template);
    } catch (error) {
      logger.error(`Error syncing single template ${metaTemplateId}:`, error);
      return null;
    }
  }
}
