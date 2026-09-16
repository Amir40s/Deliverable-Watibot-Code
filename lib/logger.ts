import chalk from 'chalk';

export const logger = {
    // Webhook logs - Blue
    webhook: {
        info: (msg: string) => console.log(chalk.blue.bold('[Webhook]'), chalk.blue(msg)),
        success: (msg: string) => console.log(chalk.blue.bold('[Webhook]'), chalk.green(msg)),
        error: (msg: string) => console.log(chalk.blue.bold('[Webhook]'), chalk.red(msg)),
        warn: (msg: string) => console.log(chalk.blue.bold('[Webhook]'), chalk.yellow(msg)),
    },

    // Flow Engine logs - Magenta
    flow: {
        separator: () => console.log(chalk.magenta('========================================')),
        info: (msg: string) => console.log(chalk.magenta.bold('[FlowEngine]'), chalk.white(msg)),
        success: (msg: string) => console.log(chalk.magenta.bold('[FlowEngine]'), chalk.green(msg)),
        error: (msg: string) => console.log(chalk.magenta.bold('[FlowEngine]'), chalk.red(msg)),
        warn: (msg: string) => console.log(chalk.magenta.bold('[FlowEngine]'), chalk.yellow(msg)),
        trigger: (msg: string) => console.log(chalk.magenta.bold('[FlowEngine]'), chalk.green.bold('🚀 ' + msg)),
        match: (msg: string) => console.log(chalk.magenta.bold('[FlowEngine]'), chalk.green('✓ ' + msg)),
        noMatch: (msg: string) => console.log(chalk.magenta.bold('[FlowEngine]'), chalk.gray('✗ ' + msg)),
        keyword: (keyword: string, message: string) => {
            console.log(
                chalk.magenta.bold('[FlowEngine]'),
                chalk.white('Checking keyword:'),
                chalk.cyan(`"${keyword}"`),
                chalk.white('against message:'),
                chalk.cyan(`"${message}"`)
            );
        },
    },

    // Message sending logs - Green
    message: {
        info: (msg: string) => console.log(chalk.green.bold('[SendMsg]'), chalk.white(msg)),
        success: (msg: string) => console.log(chalk.green.bold('[SendMsg]'), chalk.green(msg)),
        error: (msg: string) => console.log(chalk.green.bold('[SendMsg]'), chalk.red(msg)),
        payload: (payload: any) => {
            console.log(chalk.green.bold('[SendMsg]'), chalk.white('Payload:'));
            console.log(chalk.gray(JSON.stringify(payload, null, 2)));
        },
        response: (data: any) => {
            console.log(chalk.green.bold('[SendMsg]'), chalk.white('Response:'));
            console.log(chalk.gray(JSON.stringify(data, null, 2)));
        },
        warn: (msg: string) => console.log(chalk.green.bold('[SendMsg]'), chalk.yellow(msg)),
    },

    // General logs - Cyan
    general: {
        info: (tag: string, msg: string) => console.log(chalk.cyan.bold(`[${tag}]`), chalk.white(msg)),
        success: (tag: string, msg: string) => console.log(chalk.cyan.bold(`[${tag}]`), chalk.green(msg)),
        error: (tag: string, msg: string) => console.log(chalk.cyan.bold(`[${tag}]`), chalk.red(msg)),
        warn: (tag: string, msg: string) => console.log(chalk.cyan.bold(`[${tag}]`), chalk.yellow(msg)),
    },
};
