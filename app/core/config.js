import { MikroValid } from "mikrovalid";

let configPromise = null;

export async function loadConfig() {
  if (configPromise) {
    return configPromise;
  }

  configPromise = (async () => {
    const defaults = createDefaultConfig();
    const configPaths = ["config.json", "/config.json"];

    for (const path of configPaths) {
      try {
        const response = await fetch(path, { cache: "no-store" });

        if (!response.ok) {
          continue;
        }

        const loaded = await response.json();
        return validateClientConfig(mergeConfig(defaults, loaded), defaults);
      } catch {
        // Ignore missing or malformed config files and fall back to defaults.
      }
    }

    return validateClientConfig(defaults, defaults);
  })();

  return configPromise;
}

function validateClientConfig(config, fallback) {
  const mikroValid = new MikroValid(true);
  const result = mikroValid.test(
    {
      properties: {
        api: {
          baseUrl: { type: "string" },
          required: ["baseUrl"],
          type: "object",
        },
        auth: {
          enableOAuth: { type: "boolean" },
          enablePasswordless: { type: "boolean" },
          mode: { type: "string" },
          required: ["enableOAuth", "enablePasswordless", "mode", "title"],
          title: { type: "string" },
          type: "object",
        },
        required: ["api", "auth"],
      },
    },
    config,
  );

  if (!result.success || !isAbsoluteUrl(config?.api?.baseUrl ?? "")) {
    console.warn("MikroLens config.json is invalid. Falling back to defaults.", result.errors);
    return fallback;
  }

  return config;
}

function isAbsoluteUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function createDefaultConfig() {
  return {
    api: {
      baseUrl: window.location.origin,
    },
    auth: {
      enableOAuth: true,
      enablePasswordless: true,
      mode: "auto",
      title: "MikroLens",
    },
  };
}

function mergeConfig(defaults, overrides) {
  if (!overrides || typeof overrides !== "object") {
    return defaults;
  }

  const result = { ...defaults };

  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      defaults[key] &&
      typeof defaults[key] === "object" &&
      !Array.isArray(defaults[key])
    ) {
      result[key] = mergeConfig(defaults[key], value);
      continue;
    }

    result[key] = value;
  }

  return result;
}
