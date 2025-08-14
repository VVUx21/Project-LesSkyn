import ProductScraper from "@/components/productsscraping"
const Home = async () => {

  return (
    <>
      <section className="px-6 md:px-20 py-24">
        <div className="flex max-xl:flex-col gap-16">
          <div className="flex flex-col justify-center"> 
            <ProductScraper />
          </div>
        </div>
      </section>
    </>
  )
}

export default Home
