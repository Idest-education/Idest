import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `Made by <a href="https://github.com/LuckiPhoenix" target="_blank">Lucki</a>
<a> Bây giờ là ${new Date().toLocaleString()}</a>
<a> Đang chạy microservice assignment</a>
<a> uptime: ${process.uptime()}</a>
    `;
  }
}
