import { expect, test } from '@playwright/test';

test('student can register, search a career, inspect a course and view progress', async ({page}) => {
  const unique = `${Date.now()}-${test.info().project.name}`;
  const email = `iso25010-${unique}@example.test`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('ISO Quality Tester');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', {exact: true}).fill('Iso-quality-pass-123!');
  await page.getByLabel('Confirm password').fill('Iso-quality-pass-123!');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText('Hello,')).toBeVisible();

  await page.getByRole('link', {name: 'Explore careers'}).click();
  await page.getByLabel('Search careers').fill('Angular');
  await expect(page.getByRole('heading', {name: 'Angular Developer'})).toBeVisible();
  await page.getByRole('heading', {name: 'Angular Developer'}).click();
  await expect(page.getByText('What you will do')).toBeVisible();
  await page.getByRole('link', {name: 'Read course'}).first().click();
  await expect(page.getByText('LEARN BEFORE YOU LEAP')).toBeVisible();

  await page.getByRole('link', {name: 'My profile', exact: true}).click();
  await expect(page.getByText('Courses completed')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('invalid login reports an explicit accessible error', async ({page}) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('missing@example.test');
  await page.getByLabel('Password', {exact: true}).fill('Not-the-password-123!');
  await page.getByRole('button', {name: 'Sign in'}).click();
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
});
