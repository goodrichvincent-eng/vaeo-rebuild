export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          Client site not yet configured.
        </h1>
        <p className="text-gray-500 mb-6">
          Run <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">npm run extract</code> to
          pull Shopify data, then build your components.
        </p>
        <div className="text-xs text-gray-400 space-y-1">
          <p>Set <code>SHOPIFY_STORE</code> and <code>SHOPIFY_TOKEN</code> in <code>.env.local</code></p>
          <p>Powered by VAEO Rebuild</p>
        </div>
      </div>
    </main>
  );
}
