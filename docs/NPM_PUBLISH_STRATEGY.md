# npm Publish Strategy

## Package Name

npm install ega-v9

The public npm package name will be:

ega-v9

## Repository Structure

The npm package is located at:

packages/sdk-ts

## Publish Flow

Initial publish target:

cd packages/sdk-ts
npm publish --access public

## Versioning

V9 starts at:

0.1.0

## Principle

The npm package exposes the TypeScript SDK first.

Rust runtime-core remains inside the repository until the native bridge is ready.
