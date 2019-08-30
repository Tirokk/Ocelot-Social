import { gql } from '../../jest/helpers'
import Factory from '../../seed/factories'
import { createTestClient } from 'apollo-server-testing'
import { neode, getDriver } from '../../bootstrap/neo4j'
import createServer from '../../server'

let server
let query
let mutate
let notifiedUser
let authenticatedUser
const factory = Factory()
const driver = getDriver()
const instance = neode()
const categoryIds = ['cat9']
const createPostMutation = gql`
  mutation($id: ID, $title: String!, $postContent: String!, $categoryIds: [ID]!) {
    CreatePost(id: $id, title: $title, content: $postContent, categoryIds: $categoryIds) {
      id
      title
      content
    }
  }
`
const updatePostMutation = gql`
  mutation($id: ID!, $title: String!, $postContent: String!, $categoryIds: [ID]!) {
    UpdatePost(id: $id, content: $postContent, title: $title, categoryIds: $categoryIds) {
      title
      content
    }
  }
`
const createCommentMutation = gql`
  mutation($id: ID, $postId: ID!, $commentContent: String!) {
    CreateComment(id: $id, postId: $postId, content: $commentContent) {
      id
      content
    }
  }
`

beforeAll(() => {
  const createServerResult = createServer({
    context: () => {
      return {
        user: authenticatedUser,
        neode: instance,
        driver,
      }
    },
  })
  server = createServerResult.server
  const createTestClientResult = createTestClient(server)
  query = createTestClientResult.query
  mutate = createTestClientResult.mutate
})

beforeEach(async () => {
  notifiedUser = await instance.create('User', {
    id: 'you',
    name: 'Al Capone',
    slug: 'al-capone',
    email: 'test@example.org',
    password: '1234',
  })
  await instance.create('Category', {
    id: 'cat9',
    name: 'Democracy & Politics',
    icon: 'university',
  })
})

afterEach(async () => {
  await factory.cleanDatabase()
})

describe('notifications', () => {
  const notificationQuery = gql`
    query($read: Boolean) {
      currentUser {
        notifications(read: $read, orderBy: createdAt_desc) {
          read
          reason
          post {
            content
          }
          comment {
            content
          }
        }
      }
    }
  `

  describe('authenticated', () => {
    beforeEach(async () => {
      authenticatedUser = await notifiedUser.toJson()
    })

    describe('given another user', () => {
      let title
      let postContent
      let postAuthor
      const createPostAction = async () => {
        authenticatedUser = await postAuthor.toJson()
        await mutate({
          mutation: createPostMutation,
          variables: {
            id: 'p47',
            title,
            postContent,
            categoryIds,
          },
        })
        authenticatedUser = await notifiedUser.toJson()
      }

      let commentContent
      let commentAuthor
      const createCommentOnPostAction = async () => {
        await createPostAction()
        authenticatedUser = await commentAuthor.toJson()
        await mutate({
          mutation: createCommentMutation,
          variables: {
            id: 'c47',
            postId: 'p47',
            commentContent,
          },
        })
        authenticatedUser = await notifiedUser.toJson()
      }

      describe('comments on my post', () => {
        beforeEach(async () => {
          title = 'My post'
          postContent = 'My post content.'
          postAuthor = notifiedUser
        })

        describe('commenter is not me', () => {
          beforeEach(async () => {
            commentContent = 'Commenters comment.'
            commentAuthor = await instance.create('User', {
              id: 'commentAuthor',
              name: 'Mrs Comment',
              slug: 'mrs-comment',
              email: 'commentauthor@example.org',
              password: '1234',
            })
          })

          it('sends me a notification', async () => {
            await createCommentOnPostAction()
            const expected = expect.objectContaining({
              data: {
                currentUser: {
                  notifications: [
                    {
                      read: false,
                      reason: 'comment_on_post',
                      post: null,
                      comment: {
                        content: commentContent,
                      },
                    },
                  ],
                },
              },
            })
            const { query } = createTestClient(server)
            await expect(
              query({
                query: notificationQuery,
                variables: {
                  read: false,
                },
              }),
            ).resolves.toEqual(expected)
          })

          it('sends me no notification if I have blocked the comment author', async () => {
            await notifiedUser.relateTo(commentAuthor, 'blocked')
            await createCommentOnPostAction()
            const expected = expect.objectContaining({
              data: {
                currentUser: {
                  notifications: [],
                },
              },
            })
            const { query } = createTestClient(server)
            await expect(
              query({
                query: notificationQuery,
                variables: {
                  read: false,
                },
              }),
            ).resolves.toEqual(expected)
          })
        })

        describe('commenter is me', () => {
          beforeEach(async () => {
            commentContent = 'My comment.'
            commentAuthor = notifiedUser
          })

          it('sends me no notification', async () => {
            await notifiedUser.relateTo(commentAuthor, 'blocked')
            await createCommentOnPostAction()
            const expected = expect.objectContaining({
              data: {
                currentUser: {
                  notifications: [],
                },
              },
            })
            const { query } = createTestClient(server)
            await expect(
              query({
                query: notificationQuery,
                variables: {
                  read: false,
                },
              }),
            ).resolves.toEqual(expected)
          })
        })
      })

      beforeEach(async () => {
        postAuthor = await instance.create('User', {
          id: 'postAuthor',
          name: 'Mrs Post',
          slug: 'mrs-post',
          email: 'post-author@example.org',
          password: '1234',
        })
      })

      describe('mentions me in a post', () => {
        beforeEach(async () => {
          title = 'Mentioning Al Capone'
          postContent =
            'Hey <a class="mention" data-mention-id="you" href="/profile/you/al-capone">@al-capone</a> how do you do?'
        })

        it('sends me a notification', async () => {
          await createPostAction()
          const expectedContent =
            'Hey <a class="mention" data-mention-id="you" href="/profile/you/al-capone" target="_blank">@al-capone</a> how do you do?'
          const expected = expect.objectContaining({
            data: {
              currentUser: {
                notifications: [
                  {
                    read: false,
                    reason: 'mentioned_in_post',
                    post: {
                      content: expectedContent,
                    },
                    comment: null,
                  },
                ],
              },
            },
          })
          const { query } = createTestClient(server)
          await expect(
            query({
              query: notificationQuery,
              variables: {
                read: false,
              },
            }),
          ).resolves.toEqual(expected)
        })

        describe('many times', () => {
          const updatePostAction = async () => {
            const updatedContent = `
              One more mention to
              <a data-mention-id="you" class="mention" href="/profile/you">
                @al-capone
              </a>
              and again:
              <a data-mention-id="you" class="mention" href="/profile/you">
                @al-capone
              </a>
              and again
              <a data-mention-id="you" class="mention" href="/profile/you">
                @al-capone
              </a>
            `
            authenticatedUser = await postAuthor.toJson()
            await mutate({
              mutation: updatePostMutation,
              variables: {
                id: 'p47',
                title,
                postContent: updatedContent,
                categoryIds,
              },
            })
            authenticatedUser = await notifiedUser.toJson()
          }

          it('creates exactly one more notification', async () => {
            await createPostAction()
            await updatePostAction()
            const expectedContent =
              '<br>One more mention to<br><a data-mention-id="you" class="mention" href="/profile/you" target="_blank"><br>@al-capone<br></a><br>and again:<br><a data-mention-id="you" class="mention" href="/profile/you" target="_blank"><br>@al-capone<br></a><br>and again<br><a data-mention-id="you" class="mention" href="/profile/you" target="_blank"><br>@al-capone<br></a><br>'
            const expected = expect.objectContaining({
              data: {
                currentUser: {
                  notifications: [
                    {
                      read: false,
                      reason: 'mentioned_in_post',
                      post: {
                        content: expectedContent,
                      },
                      comment: null,
                    },
                    {
                      read: false,
                      reason: 'mentioned_in_post',
                      post: {
                        content: expectedContent,
                      },
                      comment: null,
                    },
                  ],
                },
              },
            })
            await expect(
              query({
                query: notificationQuery,
                variables: {
                  read: false,
                },
              }),
            ).resolves.toEqual(expected)
          })
        })

        describe('but the author of the post blocked me', () => {
          beforeEach(async () => {
            await postAuthor.relateTo(notifiedUser, 'blocked')
          })

          it('sends no notification', async () => {
            await createPostAction()
            const expected = expect.objectContaining({
              data: {
                currentUser: {
                  notifications: [],
                },
              },
            })
            const { query } = createTestClient(server)
            await expect(
              query({
                query: notificationQuery,
                variables: {
                  read: false,
                },
              }),
            ).resolves.toEqual(expected)
          })
        })
      })

      describe('mentions me in a comment', () => {
        beforeEach(async () => {
          title = 'Post where I get mentioned in a comment'
          postContent = 'Content of post where I get mentioned in a comment.'
        })

        describe('I am not blocked at all', () => {
          beforeEach(async () => {
            commentContent =
              'One mention about me with <a data-mention-id="you" class="mention" href="/profile/you" target="_blank">@al-capone</a>.'
            commentAuthor = await instance.create('User', {
              id: 'commentAuthor',
              name: 'Mrs Comment',
              slug: 'mrs-comment',
              email: 'comment-author@example.org',
              password: '1234',
            })
          })

          it('sends a notification', async () => {
            await createCommentOnPostAction()
            const expected = expect.objectContaining({
              data: {
                currentUser: {
                  notifications: [
                    {
                      read: false,
                      reason: 'mentioned_in_comment',
                      post: null,
                      comment: {
                        content: commentContent,
                      },
                    },
                  ],
                },
              },
            })
            const { query } = createTestClient(server)
            await expect(
              query({
                query: notificationQuery,
                variables: {
                  read: false,
                },
              }),
            ).resolves.toEqual(expected)
          })
        })

        describe('but the author of the post blocked me', () => {
          beforeEach(async () => {
            await postAuthor.relateTo(notifiedUser, 'blocked')
            commentContent =
              'One mention about me with <a data-mention-id="you" class="mention" href="/profile/you" target="_blank">@al-capone</a>.'
            commentAuthor = await instance.create('User', {
              id: 'commentAuthor',
              name: 'Mrs Comment',
              slug: 'mrs-comment',
              email: 'comment-author@example.org',
              password: '1234',
            })
          })

          it('sends no notification', async () => {
            await createCommentOnPostAction()
            const expected = expect.objectContaining({
              data: {
                currentUser: {
                  notifications: [],
                },
              },
            })
            const { query } = createTestClient(server)
            await expect(
              query({
                query: notificationQuery,
                variables: {
                  read: false,
                },
              }),
            ).resolves.toEqual(expected)
          })
        })
      })
    })
  })
})