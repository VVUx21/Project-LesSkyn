'use client'
import Link from 'next/link'
import React, { useState } from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  Form,
} from "@/components/ui/form"
import Inputform from './inputform'
import {authFormSchema} from '@/lib/utils'
import { signin, signup } from '@/lib/server/users.actions'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const Authform = ({type}:{type:string}) => {
    const [user,setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const formSchema = authFormSchema(type);
    const router=useRouter();

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        email: "",
        password: ''
      },
    })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    //console.log(values);
    setIsLoading(true);
    try {
      if (type === 'sign-up') {
        const userdata={
          firstName: values.firstName!,
          lastName: values.lastName!,
          email_id: values.email,
          password: values.password,
          created_at: new Date()
        }
        console.log(userdata);
        const newUser= await signup(userdata);
        setUser(newUser);
        if (newUser) {
          // Redirect to the home page or any other page after successful signup
          router.push('/onboarding');
        }
      }
      if (type === 'sign-in') {
        //console.log(values);
        const users= await signin(
          {
            email_id: values.email,
            password: values.password
          }
        );
        //console.log(users);
        if (users) router.push('/')
      } 
    } catch (error) {
      console.error('Error', error);
    } finally {
      setIsLoading(false);
    }
  }
  return (
<section className='max-w-md mx-auto p-6 bg-[#F3E9FF26] text-[#211D39] rounded-lg shadow-lg'>
  <header className='flex flex-col gap-5 md:gap-8 mb-8'>
    <Link href="/" className='flex items-center gap-2'>
      <Image 
        src="https://res.cloudinary.com/dzieihe1s/image/upload/v1765351041/Group_27_tzjtss.png" 
        alt='logo' 
        width={34} 
        height={34}
      />
      <h1 className='text-2xl text-gray-900 font-bold'>LesSkyn</h1>
    </Link>
    
    <div>
      <h2 className='text-2xl text-gray-900 font-bold lg:text-4xl mb-2'>
        {type === 'sign-in' ? 'Log in' : 'Sign up'} to LesSkyn
      </h2>
      <p className='text-base text-gray-700 font-normal'>
        {'Please enter your details'}
      </p>
    </div>
  </header>

  {user ? (
    <div className="flex flex-col gap-4">
      {/* <PlaidLink user={user} variant="primary" /> */}
    </div>
  ) : (
    <>
      <Form {...form}>
        <form 
          onSubmit={(e) => { e.preventDefault();form.handleSubmit(onSubmit)(e);}}
          className="space-y-6 flex flex-col w-full"
        >
          {type === 'sign-up' && (
            <div className="flex gap-4">
              <Inputform 
                control={form.control} 
                name='firstName' 
                label="First Name" 
                placeholder='Enter your first name' 
              />
              <Inputform 
                control={form.control} 
                name='lastName' 
                label="Last Name" 
                placeholder='Enter your last name' 
              />
            </div>
          )}

          <Inputform 
            control={form.control} 
            name="email" 
            label="Email" 
            placeholder="Enter your email" 
          />
          <Inputform 
            control={form.control} 
            name="password" 
            label="Password" 
            placeholder="Enter your password"
          />

          <div className="flex flex-col gap-4 pt-4">
            <Button 
              type='submit' 
              disabled={isLoading} 
              className="w-full cursor-pointer bg-[#211D39] disabled:bg-[#211D39]/20 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin mr-2" />
                  Loading...
                </>
              ) : type === 'sign-in' 
                ? 'Sign In' : 'Sign Up'}
            </Button>
          </div>
        </form>
      </Form>

      <footer className='flex items-center justify-center gap-1 mt-6 pt-4 border-t border-gray-200'>
        <p className='text-base text-gray-600'>
          {type === 'sign-in' ? "Don't have an account?" : 'Already have an account?'}
          <Link 
            href={type === 'sign-in' ? '/Sign-up' : '/Sign-in'} 
            className='ml-1 text-[#211D39] font-medium underline transition-colors duration-200'
          >
            {type === 'sign-in' ? 'Sign up' : 'Sign in'}
          </Link>
        </p>
      </footer>
    </>
  )}
</section>
  )
}

export default Authform