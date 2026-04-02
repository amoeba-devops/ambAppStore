import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator';
import { ChannelMasterService } from './channel-master.service';
import { successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('channel-masters')
@Controller('channel-masters')
export class ChannelMasterController {
  constructor(private readonly channelService: ChannelMasterService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: '채널 목록 조회' })
  async findAll() {
    const list = await this.channelService.findAll();
    return successListResponse(list.map(c => ({
      chnCode: c.chnCode,
      name: c.chnName,
      type: c.chnType,
      defaultPlatformFeeRate: c.chnDefaultPlatformFeeRate ? Number(c.chnDefaultPlatformFeeRate) : null,
      defaultFulfillmentFee: c.chnDefaultFulfillmentFee ? Number(c.chnDefaultFulfillmentFee) : null,
      isApiIntegrated: c.chnIsApiIntegrated,
      isActive: c.chnIsActive,
    })));
  }
}
