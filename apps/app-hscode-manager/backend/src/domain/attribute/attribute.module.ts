import { Module } from '@nestjs/common';
import { SearchCoreModule } from '../search-core/search-core.module';
import { AttributeController } from './controller/attribute.controller';
import { AttributeService } from './service/attribute.service';

/** SCR-003 속성 폼 분류 모듈 (FR-030/033). */
@Module({
  imports: [SearchCoreModule],
  controllers: [AttributeController],
  providers: [AttributeService],
})
export class AttributeModule {}
