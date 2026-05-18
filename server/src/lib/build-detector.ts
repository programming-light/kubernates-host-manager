export interface BuildConfig {
  language: string;
  framework: string | null;
  dockerfile: string;
  port: number;
  buildDir: string;
  buildCommand: string | null;
  runCommand: string | null;
  healthCheckPath: string;
}

export interface DetectedProject {
  language: string;
  framework: string | null;
  confidence: number;
  buildConfig: BuildConfig;
}

export function detectFromFiles(files: string[]): DetectedProject | null {
  const fileSet = new Set(files.map(f => f.toLowerCase()));

  if (fileSet.has('dockerfile') || fileSet.has('dockerfile')) {
    return {
      language: 'docker',
      framework: 'custom',
      confidence: 100,
      buildConfig: generateBuildConfig('docker', 'custom'),
    };
  }

  if (fileSet.has('pom.xml')) {
    return {
      language: 'java',
      framework: 'maven',
      confidence: 95,
      buildConfig: generateBuildConfig('java', 'maven'),
    };
  }

  if (fileSet.has('build.gradle') || fileSet.has('build.gradle.kts')) {
    return {
      language: 'java',
      framework: 'gradle',
      confidence: 95,
      buildConfig: generateBuildConfig('java', 'gradle'),
    };
  }

  if (fileSet.has('go.mod')) {
    return {
      language: 'go',
      framework: null,
      confidence: 95,
      buildConfig: generateBuildConfig('go', null),
    };
  }

  if (fileSet.has('package.json')) {
    const hasTypescript = files.some(f => f === 'tsconfig.json' || f.endsWith('.ts') || f.endsWith('.tsx'));

    if (hasTypescript) {
      return {
        language: 'typescript',
        framework: detectNodeFramework(files),
        confidence: 90,
        buildConfig: generateBuildConfig('typescript', detectNodeFramework(files)),
      };
    }

    return {
      language: 'javascript',
      framework: detectNodeFramework(files),
      confidence: 90,
      buildConfig: generateBuildConfig('javascript', detectNodeFramework(files)),
    };
  }

  if (fileSet.has('requirements.txt') || fileSet.has('setup.py') || fileSet.has('setup.cfg') || fileSet.has('pyproject.toml')) {
    return {
      language: 'python',
      framework: detectPythonFramework(files),
      confidence: 90,
      buildConfig: generateBuildConfig('python', detectPythonFramework(files)),
    };
  }

  if (fileSet.has('cargo.toml')) {
    return {
      language: 'rust',
      framework: null,
      confidence: 95,
      buildConfig: generateBuildConfig('rust', null),
    };
  }

  if (fileSet.has('gemfile') || fileSet.has('gemfile.lock')) {
    return {
      language: 'ruby',
      framework: detectRubyFramework(files),
      confidence: 90,
      buildConfig: generateBuildConfig('ruby', detectRubyFramework(files)),
    };
  }

  if (fileSet.has('composer.json')) {
    return {
      language: 'php',
      framework: detectPhpFramework(files),
      confidence: 90,
      buildConfig: generateBuildConfig('php', detectPhpFramework(files)),
    };
  }

  if (fileSet.has('mix.exs')) {
    return {
      language: 'elixir',
      framework: null,
      confidence: 85,
      buildConfig: generateBuildConfig('elixir', null),
    };
  }

  if (files.some(f => f.endsWith('.csproj') || f === '*.sln') || fileSet.has('global.json')) {
    return {
      language: 'csharp',
      framework: 'dotnet',
      confidence: 85,
      buildConfig: generateBuildConfig('csharp', 'dotnet'),
    };
  }

  if (fileSet.has('main.go') || files.some(f => f.endsWith('.go'))) {
    return {
      language: 'go',
      framework: null,
      confidence: 70,
      buildConfig: generateBuildConfig('go', null),
    };
  }

  if (fileSet.has('main.py') || files.some(f => f.endsWith('.py') && (f.includes('app') || f.includes('main') || f.includes('server') || f.includes('api')))) {
    return {
      language: 'python',
      framework: null,
      confidence: 60,
      buildConfig: generateBuildConfig('python', null),
    };
  }

  if (fileSet.has('server.js') || fileSet.has('app.js') || fileSet.has('index.js') || files.some(f => f.endsWith('.js'))) {
    return {
      language: 'javascript',
      framework: 'node',
      confidence: 50,
      buildConfig: generateBuildConfig('javascript', 'node'),
    };
  }

  return null;
}

function detectNodeFramework(files: string[]): string | null {
  const fileSet = new Set(files.map(f => f.toLowerCase()));

  if (fileSet.has('next.config.js') || fileSet.has('next.config.ts') || fileSet.has('next.config.mjs')) return 'next';
  if (fileSet.has('nuxt.config.js') || fileSet.has('nuxt.config.ts')) return 'nuxt';
  if (fileSet.has('svelte.config.js') || fileSet.has('svelte.config.ts') || files.some(f => f.endsWith('.svelte'))) return 'svelte';
  if (fileSet.has('astro.config.mjs') || fileSet.has('astro.config.ts')) return 'astro';
  if (fileSet.has('remix.config.js') || fileSet.has('remix.config.ts')) return 'remix';
  if (fileSet.has('angular.json') || files.some(f => f.startsWith('angular.'))) return 'angular';
  if (files.some(f => f.endsWith('.vue'))) return 'vue';
  if (files.some(f => f.endsWith('.jsx') || f.endsWith('.tsx'))) return 'react';
  if (fileSet.has('express.js') || fileSet.has('app.js') || fileSet.has('server.js')) return 'express';
  if (fileSet.has('nest-cli.json')) return 'nestjs';

  return 'node';
}

function detectPythonFramework(files: string[]): string | null {
  const fileSet = new Set(files.map(f => f.toLowerCase()));

  if (fileSet.has('manage.py')) return 'django';
  if (fileSet.has('app.py') && (fileSet.has('requirements.txt') && files.some(f => f.includes('flask')))) return 'flask';
  if (fileSet.has('main.py') && fileSet.has('requirements.txt')) return 'fastapi';
  if (fileSet.has('asgi.py') || fileSet.has('wsgi.py')) return 'django';

  return null;
}

function detectRubyFramework(files: string[]): string | null {
  const fileSet = new Set(files.map(f => f.toLowerCase()));

  if (fileSet.has('config.ru') && files.some(f => f.includes('rails'))) return 'rails';
  if (fileSet.has('gemfile') && files.some(f => f.includes('sinatra'))) return 'sinatra';

  return null;
}

function detectPhpFramework(files: string[]): string | null {
  const fileSet = new Set(files.map(f => f.toLowerCase()));

  if (fileSet.has('artisan')) return 'laravel';
  if (fileSet.has('symfony.lock') || fileSet.has('symfony.lock')) return 'symfony';

  return null;
}

export function generateBuildConfig(language: string, framework: string | null): BuildConfig {
  switch (language) {
    case 'docker':
      return {
        language: 'docker',
        framework: 'custom',
        dockerfile: 'Dockerfile',
        port: 80,
        buildDir: '.',
        buildCommand: null,
        runCommand: null,
        healthCheckPath: '/',
      };

    case 'java':
      if (framework === 'maven') {
        return {
          language: 'java',
          framework: 'maven',
          dockerfile: `
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD curl -f http://localhost:8080/ || exit 1
CMD ["java", "-jar", "app.jar"]
`,
          port: 8080,
          buildDir: '.',
          buildCommand: 'mvn package -DskipTests -B',
          runCommand: 'java -jar target/*.jar',
          healthCheckPath: '/',
        };
      } else {
        return {
          language: 'java',
          framework: 'gradle',
          dockerfile: `
FROM gradle:8-jdk21 AS builder
WORKDIR /app
COPY build.gradle* settings.gradle* ./
RUN gradle dependencies --no-daemon
COPY src ./src
RUN gradle build -x test --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD curl -f http://localhost:8080/ || exit 1
CMD ["java", "-jar", "app.jar"]
`,
          port: 8080,
          buildDir: '.',
          buildCommand: 'gradle build -x test --no-daemon',
          runCommand: 'java -jar build/libs/*.jar',
          healthCheckPath: '/',
        };
      }

    case 'go':
      return {
        language: 'go',
        framework: null,
        dockerfile: `
FROM golang:1.23 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://localhost:8080/ || exit 1
CMD ["./server"]
`,
        port: 8080,
        buildDir: '.',
        buildCommand: 'go build -o server .',
        runCommand: './server',
        healthCheckPath: '/',
      };

    case 'typescript':
      return {
        language: 'typescript',
        framework: framework || 'node',
        dockerfile: `
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build --if-present

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://localhost:3000/ || exit 1
CMD ["node", "dist/index.js"]
`,
        port: 3000,
        buildDir: '.',
        buildCommand: 'npm run build --if-present',
        runCommand: 'node dist/index.js',
        healthCheckPath: '/',
      };

    case 'javascript':
      return {
        language: 'javascript',
        framework: framework || 'node',
        dockerfile: `
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://localhost:3000/ || exit 1
CMD ["node", "index.js"]
`,
        port: 3000,
        buildDir: '.',
        buildCommand: null,
        runCommand: 'node index.js',
        healthCheckPath: '/',
      };

    case 'python':
      if (framework === 'django') {
        return {
          language: 'python',
          framework: 'django',
          dockerfile: `
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python manage.py collectstatic --noinput
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD curl -f http://localhost:8000/ || exit 1
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "project.wsgi:application"]
`,
          port: 8000,
          buildDir: '.',
          buildCommand: null,
          runCommand: 'gunicorn --bind 0.0.0.0:8000 project.wsgi:application',
          healthCheckPath: '/',
        };
      }
      return {
        language: 'python',
        framework: framework || null,
        dockerfile: `
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD curl -f http://localhost:8000/ || exit 1
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "main:app"]
`,
        port: 8000,
        buildDir: '.',
        buildCommand: null,
        runCommand: 'gunicorn --bind 0.0.0.0:8000 main:app',
        healthCheckPath: '/',
      };

    case 'rust':
      return {
        language: 'rust',
        framework: null,
        dockerfile: `
FROM rust:1.80 AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/* ./
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD curl -f http://localhost:8080/ || exit 1
CMD ["./app"]
`,
        port: 8080,
        buildDir: '.',
        buildCommand: 'cargo build --release',
        runCommand: './target/release/app',
        healthCheckPath: '/',
      };

    case 'ruby':
      return {
        language: 'ruby',
        framework: framework || null,
        dockerfile: `
FROM ruby:3.3-slim
WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle install
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD curl -f http://localhost:3000/ || exit 1
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
`,
        port: 3000,
        buildDir: '.',
        buildCommand: null,
        runCommand: 'bundle exec rails server -b 0.0.0.0',
        healthCheckPath: '/',
      };

    case 'php':
      return {
        language: 'php',
        framework: framework || null,
        dockerfile: `
FROM php:8.2-apache
WORKDIR /var/www/html
COPY . .
RUN if [ -f "composer.json" ]; then curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer && composer install --no-dev; fi
RUN chown -R www-data:www-data /var/www/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD curl -f http://localhost/ || exit 1
CMD ["apache2-foreground"]
`,
        port: 80,
        buildDir: '.',
        buildCommand: null,
        runCommand: null,
        healthCheckPath: '/',
      };

    case 'elixir':
      return {
        language: 'elixir',
        framework: null,
        dockerfile: `
FROM elixir:1.17-slim AS builder
WORKDIR /app
RUN mix local.hex --force && mix local.rebar --force
COPY mix.exs mix.lock ./
RUN mix deps.get
COPY . .
RUN mix release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/_build/prod/rel/app ./
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD curl -f http://localhost:4000/ || exit 1
CMD ["bin/app", "start"]
`,
        port: 4000,
        buildDir: '.',
        buildCommand: 'mix release',
        runCommand: 'bin/app start',
        healthCheckPath: '/',
      };

    case 'csharp':
      return {
        language: 'csharp',
        framework: 'dotnet',
        dockerfile: `
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder
WORKDIR /app
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=builder /app/publish .
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD curl -f http://localhost:8080/ || exit 1
ENTRYPOINT ["dotnet", "app.dll"]
`,
        port: 8080,
        buildDir: '.',
        buildCommand: 'dotnet publish -c Release -o publish',
        runCommand: 'dotnet publish/app.dll',
        healthCheckPath: '/',
      };

    default:
      return {
        language: 'unknown',
        framework: null,
        dockerfile: `
FROM alpine:3.19
WORKDIR /app
COPY . .
EXPOSE 80
CMD ["sh"]
`,
        port: 80,
        buildDir: '.',
        buildCommand: null,
        runCommand: null,
        healthCheckPath: '/',
      };
  }
}

export function detectProjectType(gitUrl: string): DetectedProject {
  const urlLower = gitUrl.toLowerCase();

  if (urlLower.includes('github.com') || urlLower.includes('gitlab.com') || urlLower.includes('bitbucket.org')) {
    return {
      language: 'git',
      framework: 'generic',
      confidence: 80,
      buildConfig: generateBuildConfig('docker', 'custom'),
    };
  }

  return {
    language: 'unknown',
    framework: null,
    confidence: 10,
    buildConfig: generateBuildConfig('unknown', null),
  };
}

export function generateDockerfileContent(buildConfig: BuildConfig): string {
  return buildConfig.dockerfile.trim();
}

export function detectLanguageFromName(repoName: string, description?: string): BuildConfig {
  const name = repoName.toLowerCase();

  if (name.includes('python') || name.includes('flask') || name.includes('django') || name.includes('fastapi')) {
    return generateBuildConfig('python', description?.includes('django') ? 'django' : null);
  }
  if (name.includes('java') || name.includes('spring') || name.includes('maven') || name.includes('gradle')) {
    const isGradle = name.includes('gradle') || (description?.includes('gradle') ?? false);
    return generateBuildConfig('java', isGradle ? 'gradle' : 'maven');
  }
  if (name.includes('go') || name.includes('golang')) return generateBuildConfig('go', null);
  if (name.includes('rust') || name.includes('cargo')) return generateBuildConfig('rust', null);
  if (name.includes('ruby') || name.includes('rails')) return generateBuildConfig('ruby', 'rails');
  if (name.includes('php') || name.includes('laravel')) return generateBuildConfig('php', 'laravel');
  if (name.includes('react') || name.includes('next') || name.includes('vue') || name.includes('angular')) {
    return generateBuildConfig('typescript', name.includes('next') ? 'next' : 'react');
  }
  if (name.includes('node') || name.includes('express') || name.includes('nestjs') || name.includes('nest')) {
    return generateBuildConfig('javascript', name.includes('nest') ? 'nestjs' : 'express');
  }

  return generateBuildConfig('javascript', 'node');
}
