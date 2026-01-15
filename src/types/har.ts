export interface HarHeader {
  name: string;
  value: string;
}

export interface HarQueryString {
  name: string;
  value: string;
}

export interface HarPostData {
  mimeType: string;
  text?: string;
  params?: Array<{ name: string; value: string }>;
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  headers: HarHeader[];
  queryString: HarQueryString[];
  cookies: HarHeader[];
  headersSize: number;
  bodySize: number;
  postData?: HarPostData;
}

export interface HarContent {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
}

export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  headers: HarHeader[];
  cookies: HarHeader[];
  content: HarContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
}

export interface HarTimings {
  blocked?: number;
  dns?: number;
  connect?: number;
  ssl?: number;
  send: number;
  wait: number;
  receive: number;
}

export interface HarEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  request: HarRequest;
  response: HarResponse;
  timings: HarTimings;
  serverIPAddress?: string;
  connection?: string;
}

export interface HarEntrySummary {
  id: string;
  timestamp: string;
  request: {
    method: string;
    url: string;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    mimeType: string;
    bodySize: number;
  };
}
