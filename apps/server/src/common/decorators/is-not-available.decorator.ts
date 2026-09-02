import { SetMetadata } from '@nestjs/common';

export const IsNotAvailable = () => SetMetadata('isNotAvailable', true);
