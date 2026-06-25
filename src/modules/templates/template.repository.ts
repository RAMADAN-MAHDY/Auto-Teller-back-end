import { Service } from 'typedi';
import { BaseRepository } from '../../database/base.repository';
import { TemplateModel, ITemplate } from './template.model';

@Service()
export class TemplateRepository extends BaseRepository<ITemplate> {
  constructor() {
    super(TemplateModel);
  }

  /**
   * Find a template by name.
   */
  async findByName(name: string): Promise<ITemplate | null> {
    return this.model.findOne({ name }).exec();
  }

  /**
   * Find templates created by a specific user.
   */
  async findByCreator(userId: string): Promise<ITemplate[]> {
    return this.model.find({ createdBy: userId }).exec();
  }
}
