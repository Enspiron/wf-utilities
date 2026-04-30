import path from 'node:path';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const DEFAULT_SERVER = 'grpc.nvcf.nvidia.com:443';
const DEFAULT_FUNCTION_ID = '0778f2eb-b64d-45e7-acae-7dd9b9b35b4d';
const DEFAULT_MODEL = 'megatronnmt_any_any_1b';
const PROTO_PATH = path.join(process.cwd(), 'vendor', 'nvidia-riva', 'riva_nmt_minimal.proto');

type TranslateTextRequest = {
  texts: string[];
  model: string;
  source_language: string;
  target_language: string;
  dnt_phrases?: string[];
  max_len_variation?: string;
};

type TranslateTextResponse = {
  translations?: Array<{
    text?: string | null;
    language?: string | null;
  }> | null;
};

type RivaTranslationClient = grpc.Client & {
  TranslateText(
    request: TranslateTextRequest,
    metadata: grpc.Metadata,
    callback: (error: grpc.ServiceError | null, response: TranslateTextResponse) => void
  ): void;
};

type LoadedProto = {
  nvidia?: {
    riva?: {
      nmt?: {
        RivaTranslation?: grpc.ServiceClientConstructor;
      };
    };
  };
};

let cachedClient: RivaTranslationClient | null = null;

function getNvidiaApiKey(): string | null {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  return apiKey || null;
}

function getRivaClient(): RivaTranslationClient {
  if (cachedClient) return cachedClient;

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as LoadedProto;
  const RivaTranslationClientCtor = proto.nvidia?.riva?.nmt?.RivaTranslation;

  if (!RivaTranslationClientCtor) {
    throw new Error('Failed to load the NVIDIA Riva translation client definition.');
  }

  cachedClient = new RivaTranslationClientCtor(
    process.env.NVIDIA_RIVA_SERVER?.trim() || DEFAULT_SERVER,
    grpc.credentials.createSsl()
  ) as unknown as RivaTranslationClient;

  return cachedClient;
}

export function hasNvidiaRivaConfig(): boolean {
  return Boolean(getNvidiaApiKey());
}

export async function translateWithNvidiaRiva(text: string): Promise<string | null> {
  const apiKey = getNvidiaApiKey();
  if (!apiKey) return null;

  const metadata = new grpc.Metadata();
  metadata.set('function-id', process.env.NVIDIA_RIVA_FUNCTION_ID?.trim() || DEFAULT_FUNCTION_ID);
  metadata.set('authorization', `Bearer ${apiKey}`);

  const response = await new Promise<TranslateTextResponse>((resolve, reject) => {
    getRivaClient().TranslateText(
      {
        texts: [text],
        model: process.env.NVIDIA_RIVA_MODEL?.trim() || DEFAULT_MODEL,
        source_language: 'ja',
        target_language: 'en',
      },
      metadata,
      (error, result) => {
        if (error) {
          reject(new Error(error.details || 'NVIDIA Riva translation failed.'));
          return;
        }

        resolve(result);
      }
    );
  });

  const translatedText = response.translations?.[0]?.text?.trim();
  if (!translatedText) {
    throw new Error('NVIDIA Riva translation returned an empty response.');
  }

  return translatedText;
}
