function App() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <a className="text-xl font-semibold tracking-tight" href="/">
          Gify<span className="text-accent">.</span>
        </a>
      </header>
      <section className="flex flex-1 flex-col items-center justify-center py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Videos, looped.
        </h1>
        <p className="mt-4 max-w-md text-zinc-600 dark:text-zinc-400">
          Turn a short video into a GIF, right here.
        </p>
      </section>
    </main>
  )
}

export default App
