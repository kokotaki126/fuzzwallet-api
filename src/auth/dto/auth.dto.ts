export class CreatePasskeyDto {
  publicKey: string;
  credential: string;
  address: string;
}

export class BindGoogleDto {
  idToken: string;
  address: string;
}
