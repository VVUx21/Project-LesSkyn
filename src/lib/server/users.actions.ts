'use server';
import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "./appwrite";
import { cookies } from "next/headers";
import { parseStringify } from "../utils";
const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
} = process.env;

interface getUserInfoProps {
  userId: string;
}

export const getUserInfo = async ({ userId }: getUserInfoProps) => { //it queries actual user from database rather than user from
  //session
  try {
    const { database } = await createAdminClient();

    const user = await database.listDocuments(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      [Query.equal('userId', [userId])]
    )

    return parseStringify(user.documents[0]);
  } catch (error) {
    console.log(error)
  }
}

export const getLoggedInUser = async () => {
    try {
      const { account } = await createSessionClient();

      const result = await account.get();
      const user = await getUserInfo({ userId: result.$id })
      return parseStringify(user);

    } catch (error) {
      console.error("Failed to retrieve logged-in user:", error);
      return null;
    }
  };

  export const logoutAccount = async () => {
    try {
      const { account } = await createSessionClient();
  
      (await cookies()).delete('appwrite-session');//very important..
  
      await account.deleteSession('current');
    } catch (error) {
      return null;
    }
  }

interface signInProps {
  email_id: string;
  password: string;
}

export async function signin({email_id,password}:signInProps) {
  try {
    const { account } = await createAdminClient();
    const session = await account.createEmailPasswordSession(email_id, password);
      
        (await cookies()).set("appwrite-session", session.$id, {
          path: "/",
          httpOnly: true,
          sameSite: "strict",
          secure: true,
        });

        const user = await getUserInfo({ userId: session.userId }) 

        return parseStringify(user);
  } catch (error) {
    console.error('Error', error);
}
}

interface SignUpParams {
  email_id: string;
  password: string;
  firstName: string;
  lastName: string;
  created_at: Date;
}

export async function signup({password,...userData}:SignUpParams) {//atomic functions that executes all three steps at once...
    const {email_id,firstName,lastName}=userData;
    let useraccount;
    try {
        const { account,database } = await createAdminClient();

        useraccount=await account.create(ID.unique(), email_id, password, `${firstName} ${lastName}`);
      
        if (!useraccount) {
          throw new Error('Failed to create user account');
        }

        const newuser = await database.createDocument(
            DATABASE_ID!,
            USER_COLLECTION_ID!,
            ID.unique(),
            {
              ...userData,
              userId: useraccount.$id,
            }
        );

      const session = await account.createEmailPasswordSession(email_id, password);
      
        (await cookies()).set("appwrite-session", session.$id, {
          path: "/",
          httpOnly: true,
          sameSite: "strict",
          secure: true,
        });
        
        return parseStringify(newuser);//in next js we cant pass large objects just like that through Server actions
    } catch (error) {
        console.error('Error', error);
        return null;
    }
  }
