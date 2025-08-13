import Authform from '@/components/Authform'
import React from 'react'

const signinpage = () => {
  return (
    <section className='flex-center size-full max-sm:px-6'>
        <Authform type='sign-in'/>
    </section>
  )
}

export default signinpage