<?php

namespace Tests\Unit\Email;

use App\Email\Contracts\MailTransport;
use App\Email\Data\AttachmentContent;
use App\Email\Data\Checkpoint;
use App\Email\Data\ConnectionContext;
use App\Email\Data\ConnectionHealth;
use App\Email\Data\Draft;
use App\Email\Data\EmailAddress;
use App\Email\Data\FetchPage;
use App\Email\Data\NormalizedMessage;
use App\Email\Data\SendResult;
use App\Email\Data\SendStatus;
use Illuminate\Database\Eloquent\Model;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionNamedType;

class MailTransportContractTest extends TestCase
{
    public function test_port_exposes_the_five_operations_with_dto_signatures(): void
    {
        $port = new ReflectionClass(MailTransport::class);

        $this->assertTrue($port->isInterface());

        $expected = [
            'health' => [[ConnectionContext::class], ConnectionHealth::class, false],
            'send' => [[ConnectionContext::class, Draft::class], SendResult::class, false],
            'fetchSince' => [[ConnectionContext::class, Checkpoint::class, 'array'], FetchPage::class, false],
            'getMessage' => [[ConnectionContext::class, 'string'], NormalizedMessage::class, true],
            'getAttachment' => [[ConnectionContext::class, 'string', 'string'], AttachmentContent::class, true],
        ];

        $this->assertEqualsCanonicalizing(
            array_keys($expected),
            array_map(fn ($method) => $method->getName(), $port->getMethods()),
        );

        foreach ($expected as $name => [$parameters, $returns, $nullable]) {
            $method = $port->getMethod($name);

            $this->assertSame(
                $parameters,
                array_map(fn ($parameter) => $this->typeName($parameter->getType()), $method->getParameters()),
                "{$name}() parameters",
            );
            $this->assertSame($returns, $this->typeName($method->getReturnType()), "{$name}() return type");
            $this->assertSame($nullable, $method->getReturnType()->allowsNull(), "{$name}() nullability");
        }
    }

    public function test_port_can_be_implemented(): void
    {
        $adapter = new class implements MailTransport
        {
            public function health(ConnectionContext $connection): ConnectionHealth
            {
                return ConnectionHealth::ok();
            }

            public function send(ConnectionContext $connection, Draft $draft): SendResult
            {
                return SendResult::accepted('submission-1');
            }

            public function fetchSince(ConnectionContext $connection, Checkpoint $checkpoint, array $folders): FetchPage
            {
                return FetchPage::empty($checkpoint);
            }

            public function getMessage(ConnectionContext $connection, string $providerMessageId): ?NormalizedMessage
            {
                return null;
            }

            public function getAttachment(ConnectionContext $connection, string $providerMessageId, string $partId): ?AttachmentContent
            {
                return null;
            }
        };

        $agent = new EmailAddress('agent@example.com');
        $connection = new ConnectionContext('conn-1', 'fake', $agent, $agent);

        $this->assertTrue($adapter->health($connection)->isOk());
        $this->assertSame(SendStatus::Accepted, $adapter->send($connection, new Draft($agent, ['lead@example.com']))->status);
        $this->assertTrue($adapter->fetchSince($connection, Checkpoint::start(), ['INBOX'])->isEmpty());
        $this->assertNull($adapter->getMessage($connection, 'm-1'));
        $this->assertNull($adapter->getAttachment($connection, 'm-1', 'p-1'));
    }

    public function test_port_and_dtos_do_not_depend_on_eloquent_or_provider_sdks(): void
    {
        $root = dirname(__DIR__, 3).'/app/Email';
        $checked = 0;

        foreach (['Contracts', 'Data', 'Exceptions', 'Support'] as $directory) {
            foreach (glob("{$root}/{$directory}/*.php") ?: [] as $file) {
                $class = 'App\\Email\\'.$directory.'\\'.basename($file, '.php');
                $source = (string) file_get_contents($file);

                $this->assertTrue(
                    class_exists($class) || interface_exists($class) || enum_exists($class),
                    "{$class} does not load",
                );
                $this->assertFalse(is_subclass_of($class, Model::class), "{$class} is an Eloquent model");
                $this->assertDoesNotMatchRegularExpression(
                    '/^use\s+(Illuminate|App\\\\Models|Mailtrap|Zoho|Webklex)\b/mi',
                    $source,
                    basename($file).' imports a framework, model or provider class',
                );

                $checked++;
            }
        }

        $this->assertGreaterThanOrEqual(15, $checked);
    }

    public function test_send_status_has_no_delivered_state(): void
    {
        $this->assertSame(
            ['accepted', 'rejected', 'unknown', 'throttled'],
            array_map(fn (SendStatus $status) => $status->value, SendStatus::cases()),
        );
    }

    private function typeName(mixed $type): ?string
    {
        return $type instanceof ReflectionNamedType ? $type->getName() : null;
    }
}
