import { IsNotEmpty, IsString, IsObject } from 'class-validator';

export class WebRTCOfferDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  targetUserId: string;

  @IsObject()
  @IsNotEmpty()
  offer: RTCSessionDescriptionInit;
}

export class WebRTCAnswerDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  targetUserId: string;

  @IsObject()
  @IsNotEmpty()
  answer: RTCSessionDescriptionInit;
}

export class ICECandidateDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  targetUserId: string;

  @IsObject()
  @IsNotEmpty()
  candidate: RTCIceCandidateInit;
}
