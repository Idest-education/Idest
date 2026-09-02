import { SetMetadata } from '@nestjs/common';

export const SkipEnvelope = () => SetMetadata('skipEnvelope', true);
