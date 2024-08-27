export interface Prompt {
  name: string;
  description: string;
  text: string;
  system?: string;
  user?: string;
  request?: string;
  response?: string;
  category?: string;
  tags?: string[];
}