import type { AppSettings } from '../domain/settings/settingsTypes';

function keepLocalString(localValue: string | undefined, incomingValue: string | undefined): string {
  return localValue?.trim() ? localValue : incomingValue ?? '';
}

function keepLocalNullableString(
  localValue: string | null | undefined,
  incomingValue: string | null | undefined,
): string | null | undefined {
  return localValue?.trim() ? localValue : incomingValue;
}

export function mergeImportedSettingsPreservingLocalSecrets(
  incoming: AppSettings,
  local: AppSettings | null | undefined,
): AppSettings {
  if (!local) return incoming;

  return {
    ...incoming,
    pinEnabled: local.pinEnabled,
    pinHash: keepLocalNullableString(local.pinHash, incoming.pinHash) ?? null,
    pinUpdatedAt: keepLocalNullableString(local.pinUpdatedAt, incoming.pinUpdatedAt) ?? null,
    passkeyCredentialId: null,
    morningBriefing: {
      ...incoming.morningBriefing,
      androidPublishToken: keepLocalString(
        local.morningBriefing?.androidPublishToken,
        incoming.morningBriefing?.androidPublishToken,
      ),
      androidPublishEndpoint: keepLocalString(
        local.morningBriefing?.androidPublishEndpoint,
        incoming.morningBriefing?.androidPublishEndpoint,
      ),
    },
    voice: {
      ...incoming.voice,
      elevenLabsApiKey: keepLocalString(local.voice?.elevenLabsApiKey, incoming.voice?.elevenLabsApiKey),
      elevenLabsVoiceId: keepLocalString(local.voice?.elevenLabsVoiceId, incoming.voice?.elevenLabsVoiceId),
      elevenLabsProxyUrl: keepLocalString(local.voice?.elevenLabsProxyUrl, incoming.voice?.elevenLabsProxyUrl),
    },
    instantly: {
      ...incoming.instantly,
      apiKey: keepLocalString(local.instantly?.apiKey, incoming.instantly?.apiKey),
    },
    meta: {
      ...incoming.meta,
      appId: keepLocalString(local.meta?.appId, incoming.meta?.appId),
      accessToken: keepLocalString(local.meta?.accessToken, incoming.meta?.accessToken),
      instagramUserId: keepLocalString(local.meta?.instagramUserId, incoming.meta?.instagramUserId),
      facebookPageId: keepLocalString(local.meta?.facebookPageId, incoming.meta?.facebookPageId),
      connectedAt: keepLocalNullableString(local.meta?.connectedAt, incoming.meta?.connectedAt) ?? null,
      tokenExpiresAt: keepLocalNullableString(local.meta?.tokenExpiresAt, incoming.meta?.tokenExpiresAt) ?? null,
    },
  };
}
